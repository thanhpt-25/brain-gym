import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { EventsService } from './events.service';
import { AttemptEventType } from './event-type';
import { ATTEMPT_EVENTS_QUEUE } from './attempt-events.constants';

const mockQueue = {
  add: jest.fn(),
};

const validEvent = {
  attemptId: 'attempt-abc',
  questionId: 'q-1',
  eventType: AttemptEventType.QUESTION_VIEWED,
  payload: { questionId: 'q-1', questionIndex: 0 },
  clientTs: new Date().toISOString(),
};

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getQueueToken(ATTEMPT_EVENTS_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ingest', () => {
    it('enqueues a valid batch of events', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      await service.ingest('user-1', [validEvent]);

      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-batch',
        expect.objectContaining({
          userId: 'user-1',
          events: expect.arrayContaining([
            expect.objectContaining({ attemptId: 'attempt-abc' }),
          ]),
        }),
        expect.any(Object),
      );
    });

    it('enqueues a batch of up to 50 events', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-2' });
      const events = Array.from({ length: 50 }, (_, i) => ({
        ...validEvent,
        payload: { questionId: `q-${i}`, questionIndex: i },
      }));

      await service.ingest('user-1', events);

      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when batch exceeds 50 events', async () => {
      const events = Array.from({ length: 51 }, () => validEvent);

      await expect(service.ingest('user-1', events)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for empty batch', async () => {
      await expect(service.ingest('user-1', [])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when eventType payload is invalid', async () => {
      const badEvent = {
        ...validEvent,
        eventType: AttemptEventType.FOCUS_LOST,
        payload: { durationMs: 'not-a-number' },
      };

      await expect(service.ingest('user-1', [badEvent])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for unknown eventType', async () => {
      const badEvent = {
        ...validEvent,
        eventType: 'UNKNOWN' as any,
        payload: {},
      };

      await expect(service.ingest('user-1', [badEvent])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('attaches userId from JWT to each enqueued event record', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-3' });

      await service.ingest('user-xyz', [validEvent]);

      const call = mockQueue.add.mock.calls[0];
      expect(call[1].userId).toBe('user-xyz');
    });
  });
});
