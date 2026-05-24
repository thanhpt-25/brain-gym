import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VoteTargetType } from '@prisma/client';

export interface PeerExplanationDto {
  id: string;
  questionId: string;
  squadId: string;
  authorId: string;
  content: string;
  upvotes: number;
  isTop: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmitExplanationDto {
  questionId: string;
  squadId: string;
  content: string;
}

export interface VoteResult {
  newUpvotes: number;
  isTop: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string | null;
  points: number;
  tier: 'gold' | 'silver' | 'bronze' | 'none';
}

const TOP_EXPLANATION_THRESHOLD = 5;
const TOP_PROMOTION_BONUS = 2;

const BADGE_TIERS = [
  { name: 'gold-explainer', threshold: 50 },
  { name: 'silver-explainer', threshold: 20 },
  { name: 'bronze-explainer', threshold: 5 },
] as const;

// US-1102: anti-gaming thresholds (env-overridable for testability)
function getVelocityWindowMs(): number {
  return parseInt(process.env.REPUTATION_VELOCITY_WINDOW_MS ?? '60000', 10);
}
function getVelocityBurstThreshold(): number {
  return parseInt(process.env.REPUTATION_VELOCITY_BURST_THRESHOLD ?? '5', 10);
}
function getRingThreshold(): number {
  return parseInt(process.env.REPUTATION_RING_THRESHOLD ?? '3', 10);
}

export interface ReputationFlagDto {
  id: string;
  flaggedUserId: string;
  voterId: string;
  explanationId: string;
  squadId: string;
  reason: string;
  pointsHeld: number;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

@Injectable()
export class PeerReviewService {
  private readonly logger = new Logger(PeerReviewService.name);

  constructor(private readonly prisma: PrismaService) {}

  async submitExplanation(
    userId: string,
    dto: SubmitExplanationDto,
  ): Promise<PeerExplanationDto> {
    const { questionId, squadId, content } = dto;

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question)
      throw new NotFoundException(`Question ${questionId} not found`);

    const squad = await this.prisma.organization.findUnique({
      where: { id: squadId },
      include: { members: { where: { userId } } },
    });
    if (!squad) throw new NotFoundException(`Squad ${squadId} not found`);
    if (!squad.members.length) {
      throw new ForbiddenException('You are not a member of this squad');
    }

    const explanation = await this.prisma.peerExplanation.upsert({
      where: {
        questionId_squadId_authorId: { questionId, squadId, authorId: userId },
      },
      update: { content, updatedAt: new Date() },
      create: { questionId, squadId, authorId: userId, content },
    });

    return this.toDto(explanation);
  }

  async vote(userId: string, explanationId: string): Promise<VoteResult> {
    const explanation = await this.prisma.peerExplanation.findUnique({
      where: { id: explanationId },
    });
    if (!explanation) {
      throw new NotFoundException(`Explanation ${explanationId} not found`);
    }
    if (explanation.authorId === userId) {
      throw new BadRequestException('Cannot vote on your own explanation');
    }

    // Idempotent — one vote per user per explanation
    const existing = await this.prisma.vote.findFirst({
      where: {
        userId,
        targetId: explanationId,
        targetType: VoteTargetType.EXPLANATION,
      },
    });
    if (existing) {
      return { newUpvotes: explanation.upvotes, isTop: explanation.isTop };
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.vote.create({
        data: {
          userId,
          targetId: explanationId,
          targetType: VoteTargetType.EXPLANATION,
          value: 1,
        },
      }),
      this.prisma.peerExplanation.update({
        where: { id: explanationId },
        data: { upvotes: { increment: 1 } },
      }),
    ]);

    const newUpvotes = updated.upvotes;
    let isTop = explanation.isTop;

    // US-1102: anomaly detection — skip accrual and flag if suspicious
    const anomalyReason = await this.detectAnomaly(
      userId,
      explanationId,
      explanation.authorId,
      explanation.squadId,
    );

    if (anomalyReason) {
      await this.prisma.reputationFlag.create({
        data: {
          flaggedUserId: explanation.authorId,
          voterId: userId,
          explanationId,
          squadId: explanation.squadId,
          reason: anomalyReason,
          pointsHeld: 1,
          status: 'pending',
        },
      });
      this.logger.warn(
        `reputation_flag reason=${anomalyReason} voter=${userId} explanation=${explanationId}`,
      );
      return { newUpvotes, isTop };
    }

    // Accrue +1 reputation point to the explanation author in this squad
    let rep = await this.accrueReputation(
      explanation.authorId,
      explanation.squadId,
      1,
    );

    if (!isTop && newUpvotes >= TOP_EXPLANATION_THRESHOLD) {
      await this.prisma.peerExplanation.update({
        where: { id: explanationId },
        data: { isTop: true },
      });
      isTop = true;

      // Bonus points for first-time top promotion
      rep = await this.accrueReputation(
        explanation.authorId,
        explanation.squadId,
        TOP_PROMOTION_BONUS,
      );
    }

    await this.awardTieredBadge(
      explanation.authorId,
      rep.points,
      explanationId,
    );

    return { newUpvotes, isTop };
  }

  // ─── US-1102: Flag management ─────────────────────────────────────────────

  async listFlags(
    squadId: string,
    status?: string,
  ): Promise<ReputationFlagDto[]> {
    const flags = await this.prisma.reputationFlag.findMany({
      where: { squadId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return flags.map((f) => this.toFlagDto(f));
  }

  async resolveFlag(
    flagId: string,
    resolution: 'cleared' | 'confirmed',
  ): Promise<ReputationFlagDto> {
    const flag = await this.prisma.reputationFlag.findUnique({
      where: { id: flagId },
    });
    if (!flag) throw new NotFoundException(`Flag ${flagId} not found`);
    if (flag.status !== 'pending') {
      throw new BadRequestException(`Flag already resolved as ${flag.status}`);
    }

    const updated = await this.prisma.reputationFlag.update({
      where: { id: flagId },
      data: { status: resolution, resolvedAt: new Date() },
    });

    // If cleared (vote was legit), apply the withheld points now
    if (resolution === 'cleared') {
      await this.accrueReputation(
        flag.flaggedUserId,
        flag.squadId,
        flag.pointsHeld,
      );
      this.logger.log(
        `reputation_flag_cleared flagId=${flagId} points_released=${flag.pointsHeld}`,
      );
    }

    return this.toFlagDto(updated);
  }

  async listForQuestion(
    questionId: string,
    squadId: string,
  ): Promise<PeerExplanationDto[]> {
    const explanations = await this.prisma.peerExplanation.findMany({
      where: { questionId, squadId },
      orderBy: [{ isTop: 'desc' }, { upvotes: 'desc' }, { createdAt: 'asc' }],
    });
    return explanations.map((e) => this.toDto(e));
  }

  async listTopForQuestion(questionId: string): Promise<PeerExplanationDto[]> {
    const explanations = await this.prisma.peerExplanation.findMany({
      where: { questionId, isTop: true },
      orderBy: { upvotes: 'desc' },
      take: 10,
    });
    return explanations.map((e) => this.toDto(e));
  }

  async getLeaderboard(
    squadId: string,
    limit = 10,
  ): Promise<LeaderboardEntry[]> {
    const rows = await this.prisma.userReputation.findMany({
      where: { squadId },
      orderBy: { points: 'desc' },
      take: limit,
      include: { user: { select: { id: true, displayName: true } } },
    });

    return rows.map((r) => ({
      userId: r.userId,
      displayName: r.user.displayName ?? null,
      points: r.points,
      tier: this.resolveTier(r.points),
    }));
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async accrueReputation(
    userId: string,
    squadId: string,
    delta: number,
  ) {
    return this.prisma.userReputation.upsert({
      where: { userId_squadId: { userId, squadId } },
      update: { points: { increment: delta } },
      create: { userId, squadId, points: delta },
    });
  }

  private async awardTieredBadge(
    userId: string,
    totalPoints: number,
    explanationId: string,
  ): Promise<void> {
    try {
      const tier = BADGE_TIERS.find((t) => totalPoints >= t.threshold);
      if (!tier) return;

      const badge = await this.prisma.badge.findFirst({
        where: { name: tier.name },
      });
      if (!badge) {
        this.logger.warn(`Badge ${tier.name} not found in DB`);
        return;
      }

      await this.prisma.badgeAward.upsert({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
        update: {},
        create: { userId, badgeId: badge.id },
      });

      this.logger.log(
        `Awarded ${tier.name} to user ${userId} (points=${totalPoints}, explanation=${explanationId})`,
      );
    } catch (err) {
      this.logger.error(`Failed to award badge: ${err}`);
    }
  }

  private resolveTier(points: number): 'gold' | 'silver' | 'bronze' | 'none' {
    if (points >= 50) return 'gold';
    if (points >= 20) return 'silver';
    if (points >= 5) return 'bronze';
    return 'none';
  }

  // ─── US-1102: Anomaly detection ──────────────────────────────────────────

  /**
   * Detect vote-velocity burst or vote-ring.
   * Returns a reason string if suspicious, null if legitimate.
   */
  private async detectAnomaly(
    voterId: string,
    explanationId: string,
    authorId: string,
    squadId: string,
  ): Promise<string | null> {
    const windowMs = getVelocityWindowMs();
    const burstThreshold = getVelocityBurstThreshold();
    const ringThreshold = getRingThreshold();
    const windowStart = new Date(Date.now() - windowMs);

    // velocity_burst: too many votes to this explanation within the window
    const recentVotes = await this.prisma.vote.count({
      where: {
        targetId: explanationId,
        targetType: VoteTargetType.EXPLANATION,
        createdAt: { gte: windowStart },
      },
    });
    if (recentVotes >= burstThreshold) {
      return 'velocity_burst';
    }

    // vote_ring: voter has already voted on many explanations by the same author in this squad
    const authorExplanations = await this.prisma.peerExplanation.findMany({
      where: { authorId, squadId },
      select: { id: true },
    });
    const authorExplanationIds = authorExplanations.map((e) => e.id);
    if (authorExplanationIds.length > 0) {
      const crossVotes = await this.prisma.vote.count({
        where: {
          userId: voterId,
          targetType: VoteTargetType.EXPLANATION,
          targetId: { in: authorExplanationIds },
        },
      });
      if (crossVotes >= ringThreshold) {
        return 'vote_ring';
      }
    }

    return null;
  }

  private toDto(e: {
    id: string;
    questionId: string;
    squadId: string;
    authorId: string;
    content: string;
    upvotes: number;
    isTop: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): PeerExplanationDto {
    return {
      id: e.id,
      questionId: e.questionId,
      squadId: e.squadId,
      authorId: e.authorId,
      content: e.content,
      upvotes: e.upvotes,
      isTop: e.isTop,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  private toFlagDto(f: {
    id: string;
    flaggedUserId: string;
    voterId: string;
    explanationId: string;
    squadId: string;
    reason: string;
    pointsHeld: number;
    status: string;
    createdAt: Date;
    resolvedAt: Date | null;
  }): ReputationFlagDto {
    return {
      id: f.id,
      flaggedUserId: f.flaggedUserId,
      voterId: f.voterId,
      explanationId: f.explanationId,
      squadId: f.squadId,
      reason: f.reason,
      pointsHeld: f.pointsHeld,
      status: f.status,
      createdAt: f.createdAt,
      resolvedAt: f.resolvedAt,
    };
  }
}
