import { Test, TestingModule } from '@nestjs/testing';
import { FlashcardsService } from './flashcards.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('FlashcardsService', () => {
  let service: FlashcardsService;

  const mockPrismaService = {
    deck: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    flashcard: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    flashcardReviewSchedule: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlashcardsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<FlashcardsService>(FlashcardsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== DECKS ====================

  describe('createDeck', () => {
    it('should create a deck', async () => {
      const dto = { name: 'Test Deck', description: 'Test Description' };
      const userId = 'user-1';
      mockPrismaService.deck.create.mockResolvedValue({
        id: 'deck-1',
        ...dto,
        userId,
      });

      const result = await service.createDeck(userId, dto);
      expect(result).toEqual({ id: 'deck-1', ...dto, userId });
      expect(mockPrismaService.deck.create).toHaveBeenCalledWith({
        data: { ...dto, userId },
        include: { _count: { select: { flashcards: true } } },
      });
    });
  });

  describe('getDeck', () => {
    it('should return a deck if it exists and belongs to user', async () => {
      const deck = { id: 'deck-1', userId: 'user-1', name: 'Test Deck' };
      mockPrismaService.deck.findUnique.mockResolvedValue(deck);

      const result = await service.getDeck('user-1', 'deck-1');
      expect(result).toEqual(deck);
    });

    it('should throw NotFoundException if deck does not exist', async () => {
      mockPrismaService.deck.findUnique.mockResolvedValue(null);
      await expect(service.getDeck('user-1', 'deck-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if deck belongs to another user', async () => {
      const deck = { id: 'deck-1', userId: 'user-2', name: 'Test Deck' };
      mockPrismaService.deck.findUnique.mockResolvedValue(deck);
      await expect(service.getDeck('user-1', 'deck-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ==================== SRS ====================

  describe('submitReview', () => {
    const flashcardId = 'card-1';
    const userId = 'user-1';
    const card = { id: flashcardId, deck: { userId } };

    beforeEach(() => {
      mockPrismaService.flashcard.findUnique.mockResolvedValue(card);
      mockPrismaService.flashcardReviewSchedule.findUnique.mockResolvedValue(
        null,
      );
    });

    it('quality=4: updates ReviewSchedule with correct SM-2 output (first review)', async () => {
      mockPrismaService.flashcardReviewSchedule.upsert.mockImplementation(
        ({ create }) => Promise.resolve({ id: 'sched-1', ...create }),
      );

      const result = await service.submitReview(userId, flashcardId, {
        quality: 4,
      });

      expect(result.intervalDays).toBe(1);
      expect(result.repetitions).toBe(1);
      expect(result.mastery).toBe('LEARNING');
    });

    it('quality=5 (Easy), first review: interval=1, repetitions=1, mastery=LEARNING', async () => {
      mockPrismaService.flashcardReviewSchedule.upsert.mockImplementation(
        ({ create }) => Promise.resolve({ id: 'sched-1', ...create }),
      );

      const result = await service.submitReview(userId, flashcardId, {
        quality: 5,
      });

      expect(result.intervalDays).toBe(1);
      expect(result.repetitions).toBe(1);
      expect(result.mastery).toBe('LEARNING');
    });

    it('quality=5 (Easy), second review: interval=6, repetitions=2', async () => {
      mockPrismaService.flashcardReviewSchedule.findUnique.mockResolvedValue({
        userId,
        flashcardId,
        intervalDays: 1,
        repetitions: 1,
        easeFactor: 2.5,
      });
      mockPrismaService.flashcardReviewSchedule.upsert.mockImplementation(
        ({ update }) => Promise.resolve({ id: 'sched-1', ...update }),
      );

      const result = await service.submitReview(userId, flashcardId, {
        quality: 5,
      });

      expect(result.intervalDays).toBe(6);
      expect(result.repetitions).toBe(2);
    });

    it('quality=1: lapses increment, interval resets to 1, mastery=NEW', async () => {
      mockPrismaService.flashcardReviewSchedule.findUnique.mockResolvedValue({
        userId,
        flashcardId,
        intervalDays: 6,
        repetitions: 2,
        easeFactor: 2.5,
      });
      mockPrismaService.flashcardReviewSchedule.upsert.mockImplementation(
        ({ update }) => Promise.resolve({ id: 'sched-1', ...update }),
      );

      const result = await service.submitReview(userId, flashcardId, {
        quality: 1,
      });

      expect(result.intervalDays).toBe(1);
      expect(result.repetitions).toBe(0);
      expect(result.mastery).toBe('NEW');
    });

    it('idempotency: second call with same key returns cached result without calling upsert again', async () => {
      const scheduleId = 'sched-idem-1';
      const cachedSchedule = {
        id: scheduleId,
        intervalDays: 1,
        repetitions: 1,
        mastery: 'LEARNING',
      };

      // First call: upsert fires
      mockPrismaService.flashcardReviewSchedule.upsert.mockResolvedValueOnce(
        cachedSchedule,
      );
      // findUnique: null means no pre-existing schedule (first review)
      mockPrismaService.flashcardReviewSchedule.findUnique.mockResolvedValueOnce(
        null,
      );

      const idempotencyKey = `idem-key-${Date.now()}`;

      const first = await service.submitReview(
        userId,
        `card-idem-${Date.now()}`,
        {
          quality: 4,
          idempotencyKey,
        },
      );

      // The flashcardId used must be consistent for idempotency key lookup
      // Re-run with the same flashcardId that was used
      const cardForIdem = `card-idem-2-${Date.now()}`;
      mockPrismaService.flashcard.findUnique.mockResolvedValue({
        id: cardForIdem,
        deck: { userId },
      });
      mockPrismaService.flashcardReviewSchedule.findUnique
        .mockResolvedValueOnce(null) // no existing schedule
        .mockResolvedValueOnce(cachedSchedule); // cached lookup
      mockPrismaService.flashcardReviewSchedule.upsert.mockResolvedValueOnce(
        cachedSchedule,
      );

      const idemKey2 = `idem-key-unique-${Date.now()}`;

      // First call
      await service.submitReview(userId, cardForIdem, {
        quality: 4,
        idempotencyKey: idemKey2,
      });
      const upsertCountAfterFirst =
        mockPrismaService.flashcardReviewSchedule.upsert.mock.calls.length;

      // Second call with same key — upsert should NOT be called again
      mockPrismaService.flashcardReviewSchedule.findUnique.mockResolvedValueOnce(
        cachedSchedule,
      );
      await service.submitReview(userId, cardForIdem, {
        quality: 4,
        idempotencyKey: idemKey2,
      });

      expect(
        mockPrismaService.flashcardReviewSchedule.upsert.mock.calls.length,
      ).toBe(upsertCountAfterFirst); // no additional upsert

      // Suppress unused variable warning
      void first;
    });

    it('user does not own flashcard → throws ForbiddenException', async () => {
      mockPrismaService.flashcard.findUnique.mockResolvedValue({
        id: flashcardId,
        deck: { userId: 'other-user' },
      });

      await expect(
        service.submitReview(userId, flashcardId, { quality: 3 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('flashcard not found → throws NotFoundException', async () => {
      mockPrismaService.flashcard.findUnique.mockResolvedValue(null);

      await expect(
        service.submitReview(userId, flashcardId, { quality: 3 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== getDueReviews ====================

  describe('getDueReviews', () => {
    it('should return combined scheduled and new cards', async () => {
      const userId = 'user-1';
      const scheduledReview = {
        id: 'sched-1',
        flashcardId: 'card-1',
        flashcard: { id: 'card-1', front: 'Front 1' },
      };
      const newCard = {
        id: 'card-2',
        front: 'Front 2',
        deck: { id: 'deck-1' },
      };

      mockPrismaService.flashcardReviewSchedule.findMany.mockResolvedValue([
        scheduledReview,
      ]);
      mockPrismaService.flashcard.findMany.mockResolvedValue([newCard]);

      const result = await service.getDueReviews(userId);

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('sched-1');
      expect(result[1].id).toBe('new-card-2');
      expect(result[1].mastery).toBe('NEW');
    });

    it('should pass cursor to findMany when provided', async () => {
      mockPrismaService.flashcardReviewSchedule.findMany.mockResolvedValue([]);
      mockPrismaService.flashcard.findMany.mockResolvedValue([]);

      await service.getDueReviews('user-1', undefined, 20, 'cursor-abc');

      expect(
        mockPrismaService.flashcardReviewSchedule.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 1,
          cursor: { id: 'cursor-abc' },
        }),
      );
    });
  });
});
