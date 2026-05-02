import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { AttemptEventsProcessor } from './attempt-events.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { ATTEMPT_EVENTS_QUEUE } from './attempt-events.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: ATTEMPT_EVENTS_QUEUE }),
    PrismaModule,
  ],
  controllers: [EventsController],
  providers: [EventsService, AttemptEventsProcessor],
})
export class EventsModule {}
