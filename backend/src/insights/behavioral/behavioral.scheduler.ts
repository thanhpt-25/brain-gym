import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  BEHAVIORAL_NIGHTLY_JOB,
  BEHAVIORAL_QUEUE,
} from './behavioral.constants';
import { BehavioralService } from './behavioral.service';

/**
 * RFC-008 (Sprint 5 US-503) — fan-out scheduler.
 *
 * Caller (cron, admin endpoint, or REPL) invokes `enqueueNightlyBatch()`. The
 * scheduler walks every (user, cert) pair active in the last 14 days and adds
 * one BullMQ job per pair. The BullMQ `jobId` is `behavioral:<user>:<cert>:<utcDate>`
 * so concurrent runs collapse safely — repeating the call within the same UTC
 * day produces zero duplicate work.
 *
 * Cron wiring is intentionally out-of-band so we don't pull `@nestjs/schedule`
 * into the dependency graph for one cron line. When that lib lands, a single
 * `@Cron('0 3 * * *')` annotation on a wrapper method completes the loop.
 */
@Injectable()
export class BehavioralScheduler {
  private readonly logger = new Logger(BehavioralScheduler.name);

  constructor(
    @InjectQueue(BEHAVIORAL_QUEUE) private readonly queue: Queue,
    private readonly behavioral: BehavioralService,
  ) {}

  async enqueueNightlyBatch(runDate: Date = new Date()): Promise<number> {
    if (process.env.FF_INSIGHTS_BETA !== 'true') {
      this.logger.debug(
        'FF_INSIGHTS_BETA is not enabled — skipping nightly batch enqueue',
      );
      return 0;
    }

    const pairs = await this.behavioral.listActiveUserCertPairs(runDate);
    const utcDateKey = runDate.toISOString().slice(0, 10); // YYYY-MM-DD
    const runDateIso = runDate.toISOString();

    await Promise.all(
      pairs.map(({ userId, certificationId }) =>
        this.queue.add(
          BEHAVIORAL_NIGHTLY_JOB,
          { userId, certificationId, runDateIso },
          {
            jobId: `behavioral:${userId}:${certificationId}:${utcDateKey}`,
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 200 },
          },
        ),
      ),
    );

    this.logger.log(
      `Enqueued ${pairs.length} behavioral nightly job(s) for ${utcDateKey}`,
    );
    return pairs.length;
  }
}
