import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { AttemptEventsProcessor } from './attempt-events.processor';
import { PrismaService } from '../prisma/prisma.service';
import { AttemptEventType } from './event-type';

const mockPrisma = {
  attemptEvent: {
    createMany: jest.fn(),
  },
};

function makeJob(data: Record<string, unknown>): Job {
  return { data, id: 'job-1', name: 'process-batch' } as unknown as Job;
}

const sampleBatch = {
  userId: 'user-1',
  events: [
    {
      attemptId: 'attempt-abc',
      questionId: 'q-1',
      eventType: AttemptEventType.QUESTION_VIEWED,
      payload: { questionId: 'q-1', questionIndex: 0 },
      clientTs: '2026-05-01T10:00:00.000Z',
    },
    {
      attemptId: 'attempt-abc',
      questionId: 'q-2',
      eventType: AttemptEventType.CHOICE_SELECTED,
      payload: { questionId: 'q-2', choiceId: 'c-1', selected: true },
      clientTs: '2026-05-01T10:01:00.000Z',
    },
  ],
};

describe('AttemptEventsProcessor', () => {
  let processor: AttemptEventsProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttemptEventsProcessor,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    processor = module.get<AttemptEventsProcessor>(AttemptEventsProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('writes all events in the batch to the database', async () => {
      mockPrisma.attemptEvent.createMany.mockResolvedValue({ count: 2 });

      await processor.process(makeJob(sampleBatch));

      expect(mockPrisma.attemptEvent.createMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.attemptEvent.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              attemptId: 'attempt-abc',
              userId: 'user-1',
              eventType: AttemptEventType.QUESTION_VIEWED,
            }),
            expect.objectContaining({
              eventType: AttemptEventType.CHOICE_SELECTED,
            }),
          ]),
        }),
      );
    });

    it('maps clientTs ISO string to a Date on each record', async () => {
      mockPrisma.attemptEvent.createMany.mockResolvedValue({ count: 1 });

      await processor.process(
        makeJob({ userId: 'user-1', events: [sampleBatch.events[0]] }),
      );

      const records: any[] =
        mockPrisma.attemptEvent.createMany.mock.calls[0][0].data;
      expect(records[0].clientTs).toBeInstanceOf(Date);
    });

    it('handles a single-event batch', async () => {
      mockPrisma.attemptEvent.createMany.mockResolvedValue({ count: 1 });

      await processor.process(
        makeJob({ userId: 'u-2', events: [sampleBatch.events[0]] }),
      );

      const records: any[] =
        mockPrisma.attemptEvent.createMany.mock.calls[0][0].data;
      expect(records).toHaveLength(1);
    });

    it('propagates database errors so BullMQ retries the job', async () => {
      mockPrisma.attemptEvent.createMany.mockRejectedValue(
        new Error('DB connection lost'),
      );

      await expect(processor.process(makeJob(sampleBatch))).rejects.toThrow(
        'DB connection lost',
      );
    });

    it('sets questionId to null when not provided', async () => {
      mockPrisma.attemptEvent.createMany.mockResolvedValue({ count: 1 });

      const eventWithoutQuestion = {
        attemptId: 'attempt-xyz',
        questionId: undefined,
        eventType: AttemptEventType.SUBMITTED,
        payload: { totalTimeMs: 60000, answeredCount: 10 },
        clientTs: '2026-05-01T11:00:00.000Z',
      };

      await processor.process(
        makeJob({ userId: 'u-3', events: [eventWithoutQuestion] }),
      );

      const records: any[] =
        mockPrisma.attemptEvent.createMany.mock.calls[0][0].data;
      expect(records[0].questionId).toBeNull();
    });
  });
});
