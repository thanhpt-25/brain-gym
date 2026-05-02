import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { AttemptEventType } from './event-type';

const mockEventsService = {
  ingest: jest.fn(),
};

const mockUser = { id: 'user-1', email: 'test@example.com', role: 'LEARNER' };

const validBody = {
  events: [
    {
      attemptId: 'attempt-abc',
      questionId: 'q-1',
      eventType: AttemptEventType.QUESTION_VIEWED,
      payload: { questionId: 'q-1', questionIndex: 0 },
      clientTs: new Date().toISOString(),
    },
  ],
};

describe('EventsController', () => {
  let controller: EventsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [{ provide: EventsService, useValue: mockEventsService }],
    }).compile();

    controller = module.get<EventsController>(EventsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /events/attempt', () => {
    it('calls service.ingest with userId and events', async () => {
      mockEventsService.ingest.mockResolvedValue(undefined);

      await controller.ingestAttemptEvents(
        { user: mockUser } as any,
        validBody,
      );

      expect(mockEventsService.ingest).toHaveBeenCalledWith(
        'user-1',
        validBody.events,
      );
    });

    it('returns accepted response on success', async () => {
      mockEventsService.ingest.mockResolvedValue(undefined);

      const result = await controller.ingestAttemptEvents(
        { user: mockUser } as any,
        validBody,
      );

      expect(result).toMatchObject({ accepted: true });
    });

    it('propagates BadRequestException from service', async () => {
      mockEventsService.ingest.mockRejectedValue(
        new BadRequestException('Batch too large'),
      );

      await expect(
        controller.ingestAttemptEvents({ user: mockUser } as any, {
          events: Array.from({ length: 51 }, () => validBody.events[0]),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when events array is missing', async () => {
      mockEventsService.ingest.mockRejectedValue(
        new BadRequestException('events must be an array'),
      );

      await expect(
        controller.ingestAttemptEvents({ user: mockUser } as any, {
          events: undefined as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
