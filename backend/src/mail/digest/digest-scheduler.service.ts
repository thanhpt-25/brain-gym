import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class DigestSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DigestSchedulerService.name);

  constructor(
    @InjectQueue('DIGEST_GENERATION')
    private digestQueue: Queue,
  ) {}

  onModuleInit() {
    this.scheduleWeeklyDigest();
  }

  private async scheduleWeeklyDigest() {
    this.logger.log(
      'Initializing weekly digest scheduler (Monday 8:00 AM UTC)',
    );

    try {
      const existingJobs = await this.digestQueue.getRepeatableJobs();
      const digestJobExists = existingJobs.some(
        (job) => job.name === 'generate-weekly-digest',
      );

      if (digestJobExists) {
        this.logger.log('Weekly digest job already scheduled');
        return;
      }

      await this.digestQueue.add(
        'generate-weekly-digest',
        {},
        {
          repeat: {
            pattern: '0 8 * * 1', // 8:00 AM UTC every Monday
          },
          jobId: 'weekly-digest',
        },
      );

      this.logger.log('Weekly digest job scheduled successfully');
    } catch (error) {
      this.logger.error(
        `Failed to schedule weekly digest job: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.digestQueue.removeRepeatableByKey(
        'generate-weekly-digest---0 8 * * 1',
      );
      this.logger.log('Weekly digest job unscheduled');
    } catch (error) {
      this.logger.warn(
        `Failed to unschedule digest job: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
