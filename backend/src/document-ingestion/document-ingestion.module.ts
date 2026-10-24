import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { PrismaModule } from '../prisma/prisma.module';
import { DOCUMENT_INGESTION_QUEUE } from './document-ingestion.constants';
import { DocumentIngestionService } from './document-ingestion.service';
import { DocumentIngestionController } from './document-ingestion.controller';
import { DocumentIngestionProcessor } from './document-ingestion.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: DOCUMENT_INGESTION_QUEUE }),
    BullBoardModule.forFeature({
      name: DOCUMENT_INGESTION_QUEUE,
      adapter: BullMQAdapter,
    }),
    PrismaModule,
  ],
  controllers: [DocumentIngestionController],
  providers: [DocumentIngestionService, DocumentIngestionProcessor],
})
export class DocumentIngestionModule {}
