import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AttemptEventDto } from './dto/ingest-events.dto';
import { parseEventPayload } from './event-payload.schema';
import {
  ATTEMPT_EVENTS_QUEUE,
  PROCESS_BATCH_JOB,
} from './attempt-events.constants';

@Injectable()
export class EventsService {
  constructor(
    @InjectQueue(ATTEMPT_EVENTS_QUEUE) private readonly queue: Queue,
  ) {}

  async ingest(userId: string, events: AttemptEventDto[]): Promise<void> {
    if (!events || events.length === 0) {
      throw new BadRequestException('events must be a non-empty array');
    }
    if (events.length > 50) {
      throw new BadRequestException(
        'Batch size exceeds maximum of 50 events per request',
      );
    }

    for (const event of events) {
      const result = parseEventPayload(event.eventType, event.payload);
      if (!result.success) {
        throw new BadRequestException(
          `Invalid payload for eventType ${event.eventType}`,
        );
      }
    }

    await this.queue.add(
      PROCESS_BATCH_JOB,
      { userId, events },
      { removeOnComplete: { count: 100 }, removeOnFail: { count: 200 } },
    );
  }
}
