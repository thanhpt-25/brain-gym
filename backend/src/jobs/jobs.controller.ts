import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Post } from '@nestjs/common';
import { Queue } from 'bullmq';

@Controller('jobs/test')
export class JobsController {
  constructor(
    @InjectQueue('queue:email:welcome') private readonly emailQueue: Queue,
  ) {}

  @Post('email')
  async triggerTestEmail() {
    const job = await this.emailQueue.add('welcome', {
      userId: 'test-123',
      email: 'test@certgym.io',
      name: 'Test User',
    });
    return { jobId: job.id, status: 'queued' };
  }
}
