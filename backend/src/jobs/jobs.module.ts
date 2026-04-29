/**
 * SPIKE POC — DO NOT import into AppModule.
 * This module is for BullMQ feasibility validation only.
 * Production implementation tracked in RFC-004.
 */
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EmailJobProcessor } from './email-job.processor';
import { JobsController } from './jobs.controller';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379'),
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'queue:email:welcome',
    }),
  ],
  controllers: [JobsController],
  providers: [EmailJobProcessor],
})
export class JobsModule {}
