import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CAMPAIGN_RECURRENCE_QUEUE,
  CAMPAIGN_REMINDER_QUEUE,
} from './campaign.job.interface';

@Injectable()
export class CampaignSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignSchedulerService.name);

  constructor(
    @InjectQueue(CAMPAIGN_RECURRENCE_QUEUE) private recurrenceQueue: Queue,
    @InjectQueue(CAMPAIGN_REMINDER_QUEUE) private reminderQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.scheduleJob(
      this.recurrenceQueue,
      'campaign-recurrence-scan',
      '0 * * * *', // every hour
    );
    await this.scheduleJob(
      this.reminderQueue,
      'campaign-reminder-scan',
      '0 7 * * *', // every day at 07:00 UTC
    );
  }

  async onModuleDestroy() {
    await this.removeJob(this.recurrenceQueue, 'campaign-recurrence-scan');
    await this.removeJob(this.reminderQueue, 'campaign-reminder-scan');
  }

  private async scheduleJob(queue: Queue, name: string, pattern: string) {
    try {
      const existing = await queue.getRepeatableJobs();
      if (existing.some((j) => j.name === name)) {
        this.logger.log(`${name} already scheduled`);
        return;
      }
      await queue.add(name, {}, { repeat: { pattern }, jobId: name });
      this.logger.log(`Scheduled ${name} (${pattern})`);
    } catch (err) {
      this.logger.error(`Failed to schedule ${name}`, err);
    }
  }

  private async removeJob(queue: Queue, name: string) {
    try {
      const jobs = await queue.getRepeatableJobs();
      const job = jobs.find((j) => j.name === name);
      if (job) await queue.removeRepeatableByKey(job.key);
    } catch (err) {
      this.logger.warn(`Failed to remove ${name}`, err);
    }
  }
}
