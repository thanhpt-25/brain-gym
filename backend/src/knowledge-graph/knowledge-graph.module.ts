import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { EmbeddingModule } from '../ai-question-bank/embedding/embedding.module';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { KnowledgeGraphController } from './knowledge-graph.controller';
import { OverlapProcessor, OVERLAP_QUEUE } from './overlap.processor';

@Module({
  imports: [
    PrismaModule,
    EmbeddingModule,
    BullModule.registerQueue({ name: OVERLAP_QUEUE }),
  ],
  controllers: [KnowledgeGraphController],
  providers: [KnowledgeGraphService, OverlapProcessor],
  exports: [KnowledgeGraphService],
})
export class KnowledgeGraphModule {}
