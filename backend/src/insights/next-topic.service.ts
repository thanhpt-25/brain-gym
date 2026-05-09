import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface NextTopicSuggestion {
  domain: {
    id: string;
    name: string;
  };
  reason: string;
  accuracy: number;
  sampleQuestionId: string | null;
}

/**
 * Service for suggesting the next topic to study based on domain performance.
 *
 * Logic:
 * 1. Fetch all domains for the certification with their performance stats
 * 2. Filter to domains with ≥10 attempt count
 * 3. Sort by lowest accuracy first (weakest domains are most actionable)
 * 4. Tie-break by oldest lastSeenAt (not recently practiced)
 * 5. Return top domain with a sample question
 *
 * Empty state: return null if user is well-rounded (all domains >80%)
 */
@Injectable()
export class NextTopicService {
  constructor(private readonly prisma: PrismaService) {}

  async suggestNextTopic(
    userId: string,
    certificationId: string,
  ): Promise<NextTopicSuggestion | null> {
    // Get all domains for the certification
    const certification = await this.prisma.certification.findUnique({
      where: { id: certificationId },
      include: { domains: true },
    });

    if (!certification || certification.domains.length === 0) {
      return null;
    }

    // Get performance stats for each domain
    const domainStats = await Promise.all(
      certification.domains.map(async (domain) => {
        // Count total questions answered in this domain
        const attemptQuestions = await this.prisma.answer.findMany({
          where: {
            question: {
              domainId: domain.id,
            },
            attempt: {
              exam: {
                certificationId,
              },
              userId,
            },
          },
          select: {
            questionId: true,
            isCorrect: true,
            attempt: {
              select: { submittedAt: true },
            },
          },
        });

        if (attemptQuestions.length === 0) {
          return null;
        }

        const correct = attemptQuestions.filter(
          (q): q is (typeof attemptQuestions)[0] => q.isCorrect === true,
        ).length;
        const accuracy = Math.round((correct / attemptQuestions.length) * 100);

        // Get the most recent attempt timestamp for tie-breaking
        const lastSeenAt = attemptQuestions.reduce((max: Date, q) => {
          const submitted = q.attempt.submittedAt;
          return submitted && submitted > max ? submitted : max;
        }, new Date(0));

        return {
          domainId: domain.id,
          domainName: domain.name,
          accuracy,
          attemptCount: attemptQuestions.length,
          lastSeenAt,
          questionIds: [...new Set(attemptQuestions.map((q) => q.questionId))],
        };
      }),
    );

    // Filter out null entries and domains with <10 attempts
    const validStats = domainStats
      .filter((stat) => stat && stat.attemptCount >= 10)
      .sort((a, b) => {
        // Sort by accuracy ascending (lowest first), then by lastSeenAt ascending (oldest first)
        if (a!.accuracy !== b!.accuracy) {
          return a!.accuracy - b!.accuracy;
        }
        return a!.lastSeenAt.getTime() - b!.lastSeenAt.getTime();
      });

    // Empty state: if all domains are >80%, user is well-rounded
    const worstDomain = validStats[0];
    if (!worstDomain || worstDomain.accuracy > 80) {
      return null;
    }

    // Get a sample question from this domain that the user got wrong
    const wrongQuestion = await this.prisma.answer.findFirst({
      where: {
        questionId: {
          in: worstDomain.questionIds,
        },
        isCorrect: false,
        attempt: {
          exam: {
            certificationId,
          },
          userId,
        },
      },
      select: { questionId: true },
      orderBy: { attempt: { submittedAt: 'desc' } },
    });

    // Fallback: get any question from this domain if no wrong answers found
    const fallbackQuestion = await this.prisma.question.findFirst({
      where: { domainId: worstDomain.domainId },
      select: { id: true },
    });

    const sampleQuestionId = wrongQuestion?.questionId || fallbackQuestion?.id;

    const reason = `Lowest accuracy (${worstDomain.accuracy}%) - practice to improve`;

    return {
      domain: {
        id: worstDomain.domainId,
        name: worstDomain.domainName,
      },
      reason,
      accuracy: worstDomain.accuracy,
      sampleQuestionId: sampleQuestionId ?? null,
    };
  }
}
