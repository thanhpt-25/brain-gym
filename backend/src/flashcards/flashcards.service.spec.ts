import { Test, TestingModule } from '@nestjs/testing';
import { FlashcardsService } from './flashcards.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('FlashcardsService', () => {
  let service: FlashcardsService;
  let prisma: PrismaService;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlashcardsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FlashcardsService>(FlashcardsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDeck', () => {
    it('should create a deck', async () => {
      const dto = { name: 'Test Deck', description: 'Test Description' };
      const userId = 'user-1';
      mockPrismaService.deck.create.mockResolvedValue({ id: 'deck-1', ...dto, userId });

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
      await expect(service.getDeck('user-1', 'deck-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if deck belongs to another user', async () => {
      const deck = { id: 'deck-1', userId: 'user-2', name: 'Test Deck' };
      mockPrismaService.deck.findUnique.mockResolvedValue(deck);
      await expect(service.getDeck('user-1', 'deck-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('submitReview (SRS Logic)', () => {
    const flashcardId = 'card-1';
    const userId = 'user-1';
    const card = { id: flashcardId, deck: { userId } };

    beforeEach(() => {
      mockPrismaService.flashcard.findUnique.mockResolvedValue(card);
    });

    it('should calculate SM2 for quality 5 (Easy), first review', async () => {
      mockPrismaService.flashcardReviewSchedule.findUnique.mockResolvedValue(null);
      mockPrismaService.flashcardReviewSchedule.upsert.mockImplementation(({ create }) => create);

      const result = await service.submitReview(userId, flashcardId, 5);
      
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
      expect(result.mastery).toBe('LEARNING');
    });

    it('should calculate SM2 for quality 5 (Easy), second review', async () => {
      const existingSchedule = {
        userId,
        flashcardId,
        interval: 1,
        repetitions: 1,
        easeFactor: 2.5,
      };
      mockPrismaService.flashcardReviewSchedule.findUnique.mockResolvedValue(existingSchedule);
      mockPrismaService.flashcardReviewSchedule.upsert.mockImplementation(({ update }) => update);

      const result = await service.submitReview(userId, flashcardId, 5);
      
      expect(result.interval).toBe(6);
      expect(result.repetitions).toBe(2);
    });

    it('should reset repetitions if quality < 3 (Again)', async () => {
      const existingSchedule = {
        userId,
        flashcardId,
        interval: 6,
        repetitions: 2,
        easeFactor: 2.5,
      };
      mockPrismaService.flashcardReviewSchedule.findUnique.mockResolvedValue(existingSchedule);
      mockPrismaService.flashcardReviewSchedule.upsert.mockImplementation(({ update }) => update);

      const result = await service.submitReview(userId, flashcardId, 1);
      
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(0);
      expect(result.mastery).toBe('NEW');
    });
  });

  describe('getDueReviews', () => {
    it('should return combined scheduled and new cards', async () => {
      const userId = 'user-1';
      const scheduledReview = { id: 'sched-1', flashcardId: 'card-1', flashcard: { id: 'card-1', front: 'Front 1' } };
      const newCard = { id: 'card-2', front: 'Front 2', deck: { id: 'deck-1' } };

      mockPrismaService.flashcardReviewSchedule.findMany.mockResolvedValue([scheduledReview]);
      mockPrismaService.flashcard.findMany.mockResolvedValue([newCard]);

      const result = await service.getDueReviews(userId);

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('sched-1');
      expect(result[1].id).toBe('new-card-2');
      expect(result[1].mastery).toBe('NEW');
    });
  });
});
