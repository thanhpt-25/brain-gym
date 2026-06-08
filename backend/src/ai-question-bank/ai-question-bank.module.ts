import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { QuestionsModule } from '../questions/questions.module';
import { AiQuestionBankController } from './ai-question-bank.controller';
import { AiQuestionBankService } from './ai-question-bank.service';
import { EncryptionService } from './crypto/encryption.service';
import { IngestionService } from './ingestion/ingestion.service';
import { S3UploadService } from './ingestion/s3-upload.service';
import { AI_GEN_QUEUE } from '../queues/ai-gen/ai-gen.job.interface';
import { MATERIAL_CONVERSION_QUEUE } from '../queues/material-conversion/material-conversion.job.interface';
import { LlmUsageModule } from './llm-usage/llm-usage.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { DdsModule } from './dds/dds.module';

@Module({
  imports: [
    PrismaModule,
    QuestionsModule,
    LlmUsageModule,
    EmbeddingModule,
    DdsModule,
    MulterModule.register({ limits: { fileSize: 50 * 1024 * 1024 } }),
    BullModule.registerQueue({ name: AI_GEN_QUEUE }),
    BullModule.registerQueue({ name: MATERIAL_CONVERSION_QUEUE }),
  ],
  controllers: [AiQuestionBankController],
  providers: [AiQuestionBankService, EncryptionService, IngestionService, S3UploadService],
})
export class AiQuestionBankModule {}
