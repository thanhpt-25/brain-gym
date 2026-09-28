import { Injectable, Logger } from '@nestjs/common';
import { AttemptStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AttemptsService } from '../attempts.service';
import {
  ABANDONED_RETENTION_DAYS,
  CLEANUP_BATCH,
  PRACTICE_EXAM_RETENTION_DAYS,
} from './exam-cleanup.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ExamCleanupReport {
  /** Expired attempts graded from their saved answers. */
  submitted: number;
  /** Expired attempts with no answers, marked ABANDONED. */
  abandoned: number;
  /** Old ABANDONED attempts without answers that were deleted. */
  deletedAttempts: number;
  /** Old practice exams without attempts that were deleted. */
  deletedExams: number;
}

/**
 * Housekeeping for the exam flow, run by the exam-cleanup job:
 *
 * 1. Close attempts left IN_PROGRESS past their deadline (the lazy close in
 *    AttemptsService only runs when that learner comes back).
 * 2. Delete ABANDONED attempts that hold no answers — nothing reads them
 *    (history, stats and readiness only use SUBMITTED attempts).
 * 3. Delete auto-generated practice exams (isPractice) that no longer have
 *    any attempt. Practice exams with a submitted attempt are kept: that
 *    attempt's review and history point at them.
 */
@Injectable()
export class ExamCleanupService {
  private readonly logger = new Logger(ExamCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attempts: AttemptsService,
  ) {}

  async run(now = new Date()): Promise<ExamCleanupReport> {
    const { submitted, abandoned } = await this.attempts.closeExpiredBatch(
      now,
      CLEANUP_BATCH,
    );
    const deletedAttempts = await this.deleteEmptyAbandonedAttempts(now);
    const deletedExams = await this.deleteUnusedPracticeExams(now);

    const report = { submitted, abandoned, deletedAttempts, deletedExams };
    this.logger.log(
      `Exam cleanup: closed ${submitted} submitted / ${abandoned} abandoned, ` +
        `deleted ${deletedAttempts} empty attempt(s) and ${deletedExams} practice exam(s)`,
    );
    return report;
  }

  private async deleteEmptyAbandonedAttempts(now: Date): Promise<number> {
    const stale = await this.prisma.examAttempt.findMany({
      where: {
        status: AttemptStatus.ABANDONED,
        startedAt: {
          lt: new Date(now.getTime() - ABANDONED_RETENTION_DAYS * DAY_MS),
        },
        answers: { none: {} },
        // Words saved from the attempt keep their link to it.
        capturedWords: { none: {} },
      },
      select: { id: true },
      take: CLEANUP_BATCH,
    });
    if (stale.length === 0) return 0;
    const { count } = await this.prisma.examAttempt.deleteMany({
      where: {
        id: { in: stale.map((a) => a.id) },
        // Re-checked at delete time in case one changed meanwhile.
        status: AttemptStatus.ABANDONED,
        answers: { none: {} },
      },
    });
    return count;
  }

  private async deleteUnusedPracticeExams(now: Date): Promise<number> {
    const stale = await this.prisma.exam.findMany({
      where: {
        isPractice: true,
        createdAt: {
          lt: new Date(now.getTime() - PRACTICE_EXAM_RETENTION_DAYS * DAY_MS),
        },
        attempts: { none: {} },
      },
      select: { id: true },
      take: CLEANUP_BATCH,
    });
    if (stale.length === 0) return 0;
    // ExamQuestion rows cascade; the attempts check is repeated so an
    // attempt started in between keeps its exam (attempts → exam is RESTRICT).
    const { count } = await this.prisma.exam.deleteMany({
      where: {
        id: { in: stale.map((e) => e.id) },
        isPractice: true,
        attempts: { none: {} },
      },
    });
    return count;
  }
}
