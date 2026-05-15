import { Injectable, Logger } from '@nestjs/common';
import { BehavioralInsight, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InsightKind, LOOKBACK_DAYS } from './behavioral.constants';
import { AnswerRow, InsightOutput, detectAllInsights } from './patterns';

// Words split on whitespace; cheap proxy for stem length.
function countWords(...parts: Array<string | null | undefined>): number {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .reduce((sum, p) => sum + p.trim().split(/\s+/).filter(Boolean).length, 0);
}

/** Calendar UTC date (no time component) — the `generated_for` idempotency key. */
function toUtcDate(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

@Injectable()
export class BehavioralService {
  private readonly logger = new Logger(BehavioralService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Read 14-day rolling window of answers for (user, cert), feed the pure
   * detectors, and upsert one row per (user, cert, kind, generatedFor).
   *
   * Returns the kinds that were written this run; an empty array means no
   * pattern crossed its evidence/effect floor.
   */
  async recomputeForUserCert(
    userId: string,
    certificationId: string,
    runDate: Date = new Date(),
  ): Promise<InsightKind[]> {
    const since = new Date(runDate.getTime() - LOOKBACK_DAYS * 86_400_000);
    const generatedFor = toUtcDate(runDate);

    const rows = await this.prisma.answer.findMany({
      where: {
        attempt: { userId, exam: { certificationId } },
        answeredAt: { gte: since },
      },
      select: {
        timeSpent: true,
        isCorrect: true,
        answeredAt: true,
        attempt: { select: { startedAt: true } },
        question: {
          select: {
            domainId: true,
            title: true,
            description: true,
          },
        },
      },
    });

    const answers: AnswerRow[] = rows.map((r) => ({
      // `time_spent` is stored in seconds; convert to ms for the detectors.
      timeSpentMs: typeof r.timeSpent === 'number' ? r.timeSpent * 1000 : 0,
      stemWordCount: countWords(r.question.title, r.question.description),
      answeredAt: r.answeredAt,
      attemptStartedAt: r.attempt.startedAt,
      isCorrect: r.isCorrect,
      domainId: r.question.domainId,
    }));

    const insights = detectAllInsights(answers, runDate);
    if (insights.length === 0) {
      this.logger.debug(
        `No behavioral insights for user=${userId} cert=${certificationId}`,
      );
      return [];
    }

    await Promise.all(
      insights.map((ins) =>
        this.upsertInsight(userId, certificationId, generatedFor, ins),
      ),
    );

    const kinds = insights.map((i) => i.kind);
    this.logger.debug(
      `Behavioral insights written: ${kinds.join(', ')} user=${userId} cert=${certificationId}`,
    );
    return kinds;
  }

  /**
   * Returns the set of (userId, certificationId) pairs that have at least one
   * answer in the last `LOOKBACK_DAYS` days. The nightly scheduler iterates
   * over this set and enqueues one BullMQ job per pair so the work fans out
   * naturally and BullMQ jobId-dedupe handles concurrent re-runs.
   *
   * Kept as a service method (not a controller/cron concern) so it can be
   * driven from any of:
   *   - a future `@nestjs/schedule` `@Cron` handler,
   *   - an admin endpoint hit by external cron,
   *   - manual ops invocation from a REPL.
   */
  async listActiveUserCertPairs(
    runDate: Date = new Date(),
  ): Promise<Array<{ userId: string; certificationId: string }>> {
    const since = new Date(runDate.getTime() - LOOKBACK_DAYS * 86_400_000);

    // Pull distinct (userId, certificationId) tuples through ExamAttempt → Exam.
    // `groupBy` on a join key isn't available in Prisma; aggregate in JS instead.
    const attempts = await this.prisma.examAttempt.findMany({
      where: { answers: { some: { answeredAt: { gte: since } } } },
      select: { userId: true, exam: { select: { certificationId: true } } },
    });

    const seen = new Set<string>();
    const out: Array<{ userId: string; certificationId: string }> = [];
    for (const a of attempts) {
      const certificationId = a.exam?.certificationId;
      if (!certificationId) continue;
      const key = `${a.userId}:${certificationId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ userId: a.userId, certificationId });
    }
    return out;
  }

  /**
   * Returns insights for (user, cert) generated within the last `LOOKBACK_DAYS`
   * days, sorted newest first. The FE banner endpoint can pick one per kind.
   */
  async getFreshInsights(
    userId: string,
    certificationId: string,
    runDate: Date = new Date(),
  ): Promise<BehavioralInsight[]> {
    const since = toUtcDate(
      new Date(runDate.getTime() - LOOKBACK_DAYS * 86_400_000),
    );
    return this.prisma.behavioralInsight.findMany({
      where: {
        userId,
        certificationId,
        generatedFor: { gte: since },
      },
      orderBy: { generatedFor: 'desc' },
    });
  }

  private async upsertInsight(
    userId: string,
    certificationId: string,
    generatedFor: Date,
    insight: InsightOutput,
  ): Promise<void> {
    await this.prisma.behavioralInsight.upsert({
      where: {
        userId_certificationId_kind_generatedFor: {
          userId,
          certificationId,
          kind: insight.kind,
          generatedFor,
        },
      },
      create: {
        userId,
        certificationId,
        kind: insight.kind,
        payload: insight.payload as unknown as Prisma.InputJsonValue,
        evidenceCount: insight.evidenceCount,
        generatedFor,
      },
      update: {
        payload: insight.payload as unknown as Prisma.InputJsonValue,
        evidenceCount: insight.evidenceCount,
      },
    });
  }
}
