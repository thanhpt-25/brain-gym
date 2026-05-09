import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { AttemptEventsProcessor } from './attempt-events.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { ATTEMPT_EVENTS_QUEUE } from './attempt-events.constants';
import { READINESS_QUEUE } from '../insights/readiness/readiness.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: ATTEMPT_EVENTS_QUEUE }),
    BullModule.registerQueue({ name: READINESS_QUEUE }),
    PrismaModule,
  ],
  controllers: [EventsController],
  providers: [EventsService, AttemptEventsProcessor],
})
export class EventsModule {}
