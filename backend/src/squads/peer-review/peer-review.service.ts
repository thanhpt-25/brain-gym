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
}
