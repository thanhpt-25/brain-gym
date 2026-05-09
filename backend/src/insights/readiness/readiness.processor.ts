import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  READINESS_QUEUE,
  READINESS_RECOMPUTE_JOB,
} from './readiness.constants';
import { ReadinessService } from './readiness.service';

interface ReadinessRecomputeJobData {
  userId: string;
  certificationId: string;
}

@Processor(READINESS_QUEUE)
export class ReadinessProcessor extends WorkerHost {
  private readonly logger = new Logger(ReadinessProcessor.name);

  constructor(private readonly readinessService: ReadinessService) {
    super();
  }

  async process(job: Job<ReadinessRecomputeJobData>): Promise<void> {
    if (process.env.FF_PREDICTOR_BETA !== 'true') {
      this.logger.debug(
        `FF_PREDICTOR_BETA is not enabled — skipping ${READINESS_RECOMPUTE_JOB} job ${job.id}`,
      );
      return;
    }

    const { userId, certificationId } = job.data;

    this.logger.debug(
      `Processing ${READINESS_RECOMPUTE_JOB} job ${job.id}: user=${userId} cert=${certificationId}`,
    );

    await this.readinessService.recompute(userId, certificationId);
  }
}
