import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

export interface WelcomeEmailJob {
  userId: string;
  email: string;
  name: string;
}

@Processor('queue:email:welcome')
export class EmailJobProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailJobProcessor.name);

  async process(job: Job<WelcomeEmailJob>): Promise<void> {
    this.logger.log(
      `Processing welcome email job ${job.id} for ${job.data.email}`,
    );
    // Simulate email send delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.logger.log(`Welcome email sent to ${job.data.email}`);
  }
}
