import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../prisma/prisma.module';
import { QuestionsModule } from '../questions/questions.module';
import { AiQuestionBankController } from './ai-question-bank.controller';
import { AiQuestionBankService } from './ai-question-bank.service';
import { EncryptionService } from './crypto/encryption.service';
import { IngestionService } from './ingestion/ingestion.service';

@Module({
    imports: [
        PrismaModule,
        QuestionsModule,
        MulterModule.register({ limits: { fileSize: 20 * 1024 * 1024 } }), // 20 MB max PDF
    ],
    controllers: [AiQuestionBankController],
    providers: [AiQuestionBankService, EncryptionService, IngestionService],
})
export class AiQuestionBankModule {}
