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

const TOP_EXPLANATION_THRESHOLD = 5; // upvotes needed to earn "top" badge

@Injectable()
export class PeerReviewService {
  private readonly logger = new Logger(PeerReviewService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submit or update an explanation for a question within a squad.
   * Each member may have at most one explanation per question per squad.
   */
  async submitExplanation(
    userId: string,
    dto: SubmitExplanationDto,
  ): Promise<PeerExplanationDto> {
    const { questionId, squadId, content } = dto;

    // Verify question exists
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question)
      throw new NotFoundException(`Question ${questionId} not found`);

    // Verify squad exists and user is a member
    const squad = await this.prisma.organization.findUnique({
      where: { id: squadId },
      include: {
        memberships: { where: { userId } },
      },
    });
    if (!squad) throw new NotFoundException(`Squad ${squadId} not found`);
    if (!squad.memberships.length) {
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

  /**
   * Vote on a peer explanation. Prevents duplicate votes from the same user.
   */
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

    // Idempotent vote — one vote per user per explanation
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

    // Promote to top if threshold reached and not already top
    if (!isTop && newUpvotes >= TOP_EXPLANATION_THRESHOLD) {
      await this.prisma.peerExplanation.update({
        where: { id: explanationId },
        data: { isTop: true },
      });
      isTop = true;

      // Award badge to author
      await this.awardTopExplanationBadge(explanation.authorId, explanationId);
    }

    return { newUpvotes, isTop };
  }

  /**
   * List all explanations for a question within a squad, ordered by upvotes desc.
   */
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

  /**
   * List top explanations across all squads for a question.
   */
  async listTopForQuestion(questionId: string): Promise<PeerExplanationDto[]> {
    const explanations = await this.prisma.peerExplanation.findMany({
      where: { questionId, isTop: true },
      orderBy: { upvotes: 'desc' },
      take: 10,
    });
    return explanations.map((e) => this.toDto(e));
  }

  private async awardTopExplanationBadge(
    userId: string,
    explanationId: string,
  ): Promise<void> {
    try {
      // Find the "top-explainer" badge
      const badge = await this.prisma.badge.findFirst({
        where: { code: 'top-explainer' },
      });
      if (!badge) {
        this.logger.warn('top-explainer badge not found in DB');
        return;
      }

      await this.prisma.userBadge.upsert({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
        update: {},
        create: {
          userId,
          badgeId: badge.id,
          awardedAt: new Date(),
          meta: { explanationId },
        },
      });

      this.logger.log(`Awarded top-explainer badge to user ${userId}`);
    } catch (err) {
      this.logger.error(`Failed to award badge: ${err}`);
    }
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
