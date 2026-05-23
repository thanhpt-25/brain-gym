import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { LlmUsageModule } from '../llm-usage/llm-usage.module';
import { EmbeddingService } from './embedding.service';
import { EmbeddingProcessor } from './embedding.processor';
import { EMBEDDING_QUEUE } from './embedding.job.interface';

@Module({
  imports: [
    PrismaModule,
    LlmUsageModule,
    BullModule.registerQueue({ name: EMBEDDING_QUEUE }),
  ],
  providers: [EmbeddingService, EmbeddingProcessor],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
