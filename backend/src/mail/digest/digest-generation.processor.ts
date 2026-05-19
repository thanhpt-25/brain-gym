import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DigestGenerationService } from './digest-generation.service';

@Processor('DIGEST_GENERATION')
export class DigestGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(DigestGenerationProcessor.name);

  constructor(private digestService: DigestGenerationService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing digest generation job: ${job.id}`);

    try {
      const result = await this.digestService.generateWeeklyDigests();
      this.logger.log(
        `Digest generation completed: sent=${result.sent}, skipped=${result.skipped}, failed=${result.failed}`,
      );
    } catch (error) {
      this.logger.error(
        `Digest generation job failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: unknown) {
    this.logger.log(`Job ${job.id} completed with result:`, result);
  }
}
