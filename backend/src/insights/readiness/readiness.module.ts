import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { READINESS_QUEUE } from './readiness.constants';
import { ReadinessService } from './readiness.service';
import { ReadinessProcessor } from './readiness.processor';
import { ReadinessController } from './readiness.controller';

@Module({
  imports: [BullModule.registerQueue({ name: READINESS_QUEUE }), PrismaModule],
  controllers: [ReadinessController],
  providers: [ReadinessService, ReadinessProcessor],
  exports: [ReadinessService, BullModule],
})
export class ReadinessModule {}
