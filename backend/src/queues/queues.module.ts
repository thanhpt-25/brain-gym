import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmUsageModule } from '../ai-question-bank/llm-usage/llm-usage.module';
import { AiGenProcessor } from './ai-gen/ai-gen.processor';
import { AI_GEN_QUEUE } from './ai-gen/ai-gen.job.interface';
import { IngestionService } from '../ai-question-bank/ingestion/ingestion.service';
import { EncryptionService } from '../ai-question-bank/crypto/encryption.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
        },
      }),
    }),
    BullModule.registerQueue({ name: AI_GEN_QUEUE }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: AI_GEN_QUEUE,
      adapter: BullMQAdapter,
    }),
    PrismaModule,
    LlmUsageModule,
  ],
  providers: [AiGenProcessor, IngestionService, EncryptionService],
  exports: [BullModule],
})
export class QueuesModule {}
