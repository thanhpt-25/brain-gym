import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { BEHAVIORAL_QUEUE } from './behavioral.constants';
import { BehavioralProcessor } from './behavioral.processor';
import { BehavioralScheduler } from './behavioral.scheduler';
import { BehavioralService } from './behavioral.service';

@Module({
  imports: [BullModule.registerQueue({ name: BEHAVIORAL_QUEUE }), PrismaModule],
  providers: [BehavioralService, BehavioralProcessor, BehavioralScheduler],
  exports: [BehavioralService, BehavioralScheduler, BullModule],
})
export class BehavioralModule {}
