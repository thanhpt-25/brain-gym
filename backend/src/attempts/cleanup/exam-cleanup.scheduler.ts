import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  EXAM_CLEANUP_JOB,
  EXAM_CLEANUP_PATTERN,
  EXAM_CLEANUP_QUEUE,
} from './exam-cleanup.constants';

/** Registers the hourly exam-cleanup repeatable job (see ExamCleanupService). */
@Injectable()
export class ExamCleanupScheduler implements OnModuleInit {
  private readonly logger = new Logger(ExamCleanupScheduler.name);

  constructor(@InjectQueue(EXAM_CLEANUP_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    try {
      const existing = await this.queue.getRepeatableJobs();
      // Replace a schedule left from a different pattern.
      for (const job of existing) {
        if (
          job.name === EXAM_CLEANUP_JOB &&
          job.pattern !== EXAM_CLEANUP_PATTERN
        ) {
          await this.queue.removeRepeatableByKey(job.key);
        }
      }
      if (
        existing.some(
          (j) =>
            j.name === EXAM_CLEANUP_JOB && j.pattern === EXAM_CLEANUP_PATTERN,
        )
      ) {
        return;
      }
      await this.queue.add(
        EXAM_CLEANUP_JOB,
        {},
        {
          repeat: { pattern: EXAM_CLEANUP_PATTERN },
          jobId: EXAM_CLEANUP_JOB,
          removeOnComplete: { count: 48 },
          removeOnFail: { count: 48 },
        },
      );
      this.logger.log(
        `Scheduled ${EXAM_CLEANUP_JOB} (${EXAM_CLEANUP_PATTERN})`,
      );
    } catch (err) {
      // Redis being down must not stop the API from starting.
      this.logger.error(`Failed to schedule ${EXAM_CLEANUP_JOB}`, err);
    }
  }
}
