import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReadinessModule } from './readiness/readiness.module';
import { InsightsController } from './insights.controller';
import { NextTopicService } from './next-topic.service';

@Module({
  imports: [PrismaModule, ReadinessModule],
  controllers: [InsightsController],
  providers: [NextTopicService],
  exports: [ReadinessModule, NextTopicService],
})
export class InsightsModule {}
