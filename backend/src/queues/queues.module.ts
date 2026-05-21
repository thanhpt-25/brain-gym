import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmUsageModule } from '../ai-question-bank/llm-usage/llm-usage.module';
import { AiGenProcessor } from './ai-gen/ai-gen.processor';
import { AI_GEN_QUEUE } from './ai-gen/ai-gen.job.interface';
import { SCENARIO_GENERATION_QUEUE } from './scenario-generation/scenario-generation.job.interface';
import { DIGEST_GENERATION_QUEUE } from './digest-generation/digest-generation.job.interface';
import { COACH_SESSION_MONITORING_QUEUE } from './coach-session-monitoring/coach-session-monitoring.job.interface';
import { IngestionService } from '../ai-question-bank/ingestion/ingestion.service';
import { EncryptionService } from '../ai-question-bank/crypto/encryption.service';
import { DigestGenerationProcessor } from '../mail/digest/digest-generation.processor';
import { DigestModule } from '../mail/digest/digest.module';
import { BurnoutProcessor } from './processors/burnout.processor';
import { TrainingModule } from '../training/training.module';

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
    BullModule.registerQueue({ name: SCENARIO_GENERATION_QUEUE }),
    BullModule.registerQueue({ name: DIGEST_GENERATION_QUEUE }),
    BullModule.registerQueue({ name: COACH_SESSION_MONITORING_QUEUE }),
    BullModule.registerQueue({ name: 'burnout-detection' }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: AI_GEN_QUEUE,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: SCENARIO_GENERATION_QUEUE,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: DIGEST_GENERATION_QUEUE,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: COACH_SESSION_MONITORING_QUEUE,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'burnout-detection',
      adapter: BullMQAdapter,
    }),
    PrismaModule,
    LlmUsageModule,
    DigestModule,
    TrainingModule,
  ],
  providers: [
    AiGenProcessor,
    DigestGenerationProcessor,
    BurnoutProcessor,
    IngestionService,
    EncryptionService,
  ],
  exports: [BullModule],
})
export class QueuesModule {}
