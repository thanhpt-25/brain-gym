import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { QuestionsModule } from '../questions/questions.module';
import { AiQuestionBankController } from './ai-question-bank.controller';
import { AiQuestionBankService } from './ai-question-bank.service';
import { EncryptionService } from './crypto/encryption.service';
import { IngestionService } from './ingestion/ingestion.service';
import { AI_GEN_QUEUE } from '../queues/ai-gen/ai-gen.job.interface';

@Module({
  imports: [
    PrismaModule,
    QuestionsModule,
    MulterModule.register({ limits: { fileSize: 20 * 1024 * 1024 } }),
    BullModule.registerQueue({ name: AI_GEN_QUEUE }),
  ],
  controllers: [AiQuestionBankController],
  providers: [AiQuestionBankService, EncryptionService, IngestionService],
})
export class AiQuestionBankModule {}
