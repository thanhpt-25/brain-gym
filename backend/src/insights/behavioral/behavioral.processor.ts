import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  BEHAVIORAL_NIGHTLY_JOB,
  BEHAVIORAL_QUEUE,
} from './behavioral.constants';
import { BehavioralService } from './behavioral.service';

/**
 * Job payload shape. The scheduler enqueues one job per (user, cert) pair —
 * keeping the payload small lets BullMQ retry/dedupe at the granularity that
 * matches our idempotency key on `behavioral_insights`.
 */
interface BehavioralNightlyJobData {
  userId: string;
  certificationId: string;
  /** Optional override; defaults to `new Date()` inside the service. */
  runDateIso?: string;
}

@Processor(BEHAVIORAL_QUEUE)
export class BehavioralProcessor extends WorkerHost {
  private readonly logger = new Logger(BehavioralProcessor.name);

  constructor(private readonly behavioral: BehavioralService) {
    super();
  }

  async process(job: Job<BehavioralNightlyJobData>): Promise<void> {
    if (process.env.FF_INSIGHTS_BETA !== 'true') {
      this.logger.debug(
        `FF_INSIGHTS_BETA is not enabled — skipping ${BEHAVIORAL_NIGHTLY_JOB} job ${job.id}`,
      );
      return;
    }

    const { userId, certificationId, runDateIso } = job.data;
    const runDate = runDateIso ? new Date(runDateIso) : new Date();

    this.logger.debug(
      `Processing ${BEHAVIORAL_NIGHTLY_JOB} job ${job.id}: user=${userId} cert=${certificationId}`,
    );

    const kinds = await this.behavioral.recomputeForUserCert(
      userId,
      certificationId,
      runDate,
    );

    this.logger.debug(
      `Behavioral job ${job.id} wrote ${kinds.length} insight(s): ${kinds.join(', ') || '(none)'}`,
    );
  }
}
