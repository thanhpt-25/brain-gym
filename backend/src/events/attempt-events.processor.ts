import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ATTEMPT_EVENTS_QUEUE,
  PROCESS_BATCH_JOB,
} from './attempt-events.constants';
import { AttemptEventType } from './event-type';
import {
  READINESS_QUEUE,
  READINESS_RECOMPUTE_JOB,
} from '../insights/readiness/readiness.constants';

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

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(READINESS_QUEUE) private readonly readinessQueue: Queue,
  ) {
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

    // Trigger readiness recompute (debounced 5s) for every unique SUBMITTED attempt.
    const submittedAttemptIds = [
      ...new Set(
        events
          .filter((e) => e.eventType === AttemptEventType.SUBMITTED)
          .map((e) => e.attemptId),
      ),
    ];

    if (submittedAttemptIds.length > 0) {
      const attempts = await this.prisma.attempt.findMany({
        where: { id: { in: submittedAttemptIds } },
        select: { id: true, exam: { select: { certificationId: true } } },
      });

      for (const attempt of attempts) {
        const certificationId = attempt.exam?.certificationId;
        if (!certificationId) continue;

        // jobId deduplication collapses concurrent flushes for the same (user, cert).
        await this.readinessQueue.add(
          READINESS_RECOMPUTE_JOB,
          { userId, certificationId },
          {
            jobId: `readiness:${userId}:${certificationId}`,
            delay: 5_000,
            removeOnComplete: { count: 50 },
            removeOnFail: { count: 100 },
          },
        );
      }
    }
  }
}
