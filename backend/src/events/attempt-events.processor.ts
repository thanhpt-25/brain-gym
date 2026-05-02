import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ATTEMPT_EVENTS_QUEUE,
  PROCESS_BATCH_JOB,
} from './attempt-events.constants';

interface EventRecord {
  attemptId: string;
  questionId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  clientTs: string;
}

interface BatchJobData {
  userId: string;
  events: EventRecord[];
}

@Processor(ATTEMPT_EVENTS_QUEUE)
export class AttemptEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(AttemptEventsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<BatchJobData>): Promise<void> {
    const { userId, events } = job.data;

    this.logger.debug(
      `Processing ${PROCESS_BATCH_JOB} job ${job.id}: ${events.length} events for user ${userId}`,
    );

    const records = events.map((e) => ({
      attemptId: e.attemptId,
      userId,
      questionId: e.questionId ?? null,
      eventType: e.eventType,
      payload: e.payload as Prisma.InputJsonValue,
      clientTs: new Date(e.clientTs),
    }));

    await this.prisma.attemptEvent.createMany({ data: records });
  }
}
