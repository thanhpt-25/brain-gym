import { Injectable, Logger } from '@nestjs/common';
import { ReadinessScore, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeReadinessScore } from './heuristic';

@Injectable()
export class ReadinessService {
  private readonly logger = new Logger(ReadinessService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recompute(userId: string, certificationId: string): Promise<void> {
    this.logger.debug(
      `Recomputing readiness for user=${userId} cert=${certificationId}`,
    );

    const [
      srsCoverage,
      recentAccuracy14d,
      domainSpread,
      timePressure,
      attempts,
    ] = await Promise.all([
      this.computeSrsCoverage(userId, certificationId),
      this.computeRecentAccuracy14d(userId, certificationId),
      this.computeDomainSpread(userId, certificationId),
      this.computeTimePressure(userId, certificationId),
      this.countAttempts(userId, certificationId),
    ]);

    const result = computeReadinessScore(
      { srsCoverage, recentAccuracy14d, domainSpread, timePressure },
      attempts,
    );

    await this.prisma.readinessScore.upsert({
      where: { userId_certificationId: { userId, certificationId } },
      create: {
        userId,
        certificationId,
        score: result.score,
        confidence: result.confidence,
        attempts,
        signals: result.signals as unknown as Prisma.InputJsonValue,
        computedAt: new Date(),
      },
      update: {
        score: result.score,
        confidence: result.confidence,
        attempts,
        signals: result.signals as unknown as Prisma.InputJsonValue,
        computedAt: new Date(),
      },
    });

    this.logger.debug(
      `Readiness score saved: score=${result.score} confidence=${result.confidence} user=${userId} cert=${certificationId}`,
    );
  }

  async getReadinessScore(
    userId: string,
    certificationId: string,
  ): Promise<ReadinessScore | null> {
    return this.prisma.readinessScore.findUnique({
      where: { userId_certificationId: { userId, certificationId } },
    });
  }

  private async computeSrsCoverage(
    userId: string,
    certificationId: string,
  ): Promise<number> {
    const [totalQuestions, scheduledQuestions] = await Promise.all([
      this.prisma.question.count({
        where: { certificationId },
      }),
      this.prisma.reviewSchedule.count({
        where: {
          userId,
          question: { certificationId },
        },
      }),
    ]);

    if (totalQuestions === 0) return 0;
    return scheduledQuestions / totalQuestions;
  }

  private async computeRecentAccuracy14d(
    userId: string,
    certificationId: string,
  ): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - 14);

    const [total, correct] = await Promise.all([
      this.prisma.answer.count({
        where: {
          attempt: { userId, exam: { certificationId } },
          answeredAt: { gte: since },
        },
      }),
      this.prisma.answer.count({
        where: {
          attempt: { userId, exam: { certificationId } },
          answeredAt: { gte: since },
          isCorrect: true,
        },
      }),
    ]);

    if (total === 0) return 0;
    return correct / total;
  }

  private async computeDomainSpread(
    userId: string,
    certificationId: string,
  ): Promise<number> {
    const [totalDomainRows, answeredDomains] = await Promise.all([
      this.prisma.question
        .findMany({
          where: { certificationId, domainId: { not: null } },
          select: { domainId: true },
          distinct: ['domainId'],
        })
        .then((rows) => rows.length),
      this.prisma.answer
        .findMany({
          where: {
            attempt: { userId, exam: { certificationId } },
            question: { domainId: { not: null } },
          },
          select: { question: { select: { domainId: true } } },
          distinct: ['questionId'],
        })
        .then((rows) => {
          const domainIds = new Set(
            rows
              .map((r) => r.question.domainId)
              .filter((d): d is string => d !== null),
          );
          return domainIds.size;
        }),
    ]);

    if (totalDomainRows === 0) return 0;
    return answeredDomains / totalDomainRows;
  }

  private async computeTimePressure(
    userId: string,
    certificationId: string,
  ): Promise<number> {
    const submittedEvents = await this.prisma.attemptEvent.findMany({
      where: {
        userId,
        eventType: 'SUBMITTED',
        attempt: { exam: { certificationId } },
      },
      select: { payload: true },
    });

    if (submittedEvents.length === 0) return 0;

    const fractions = submittedEvents
      .map((e) => {
        const payload = e.payload as Record<string, unknown>;
        const val = payload?.timePressure;
        if (typeof val === 'number' && Number.isFinite(val)) return val;
        return null;
      })
      .filter((v): v is number => v !== null);

    if (fractions.length === 0) return 0;

    const avg = fractions.reduce((sum, v) => sum + v, 0) / fractions.length;
    return Math.min(1, Math.max(0, avg));
  }

  private async countAttempts(
    userId: string,
    certificationId: string,
  ): Promise<number> {
    return this.prisma.answer.count({
      where: {
        attempt: { userId, exam: { certificationId } },
      },
    });
  }
}
