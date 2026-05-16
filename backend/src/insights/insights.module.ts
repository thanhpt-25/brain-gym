import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReadinessModule } from './readiness/readiness.module';
import { BehavioralModule } from './behavioral/behavioral.module';
import { InsightsController } from './insights.controller';
import { NextTopicService } from './next-topic.service';

@Module({
  imports: [PrismaModule, ReadinessModule, BehavioralModule],
  controllers: [InsightsController],
  providers: [NextTopicService],
  exports: [ReadinessModule, BehavioralModule, NextTopicService],
})
export class InsightsModule {}
