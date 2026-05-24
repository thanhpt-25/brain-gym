import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PeerReviewService } from './peer-review.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  peerExplanation: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  vote: { findFirst: jest.fn(), create: jest.fn(), count: jest.fn() },
  userReputation: { upsert: jest.fn(), findMany: jest.fn() },
  badge: { findFirst: jest.fn() },
  badgeAward: { upsert: jest.fn() },
  question: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn() },
  reputationFlag: { create: jest.fn() },
  $transaction: jest.fn(),
};

describe('PeerReviewService — reputation engine (US-1005)', () => {
  let service: PeerReviewService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeerReviewService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(PeerReviewService);
  });

  describe('vote', () => {
    const explanation = {
      id: 'exp-1',
      authorId: 'author-1',
      squadId: 'squad-1',
      upvotes: 3,
      isTop: false,
    };

    beforeEach(() => {
      mockPrisma.peerExplanation.findUnique.mockResolvedValue(explanation);
      mockPrisma.vote.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation((ops) => Promise.all(ops));
      mockPrisma.vote.create.mockResolvedValue({});
      mockPrisma.peerExplanation.update.mockResolvedValue({
        ...explanation,
        upvotes: 4,
      });
      mockPrisma.userReputation.upsert.mockResolvedValue({
        userId: 'author-1',
        squadId: 'squad-1',
        points: 4,
      });
      mockPrisma.badge.findFirst.mockResolvedValue(null);
      // US-1102: anti-gaming — return safe values below burst/ring thresholds
      mockPrisma.vote.count.mockResolvedValue(0);
      mockPrisma.peerExplanation.findMany.mockResolvedValue([]);
      mockPrisma.reputationFlag.create.mockResolvedValue({});
    });

    it('throws BadRequestException when voter is the author', async () => {
      await expect(service.vote('author-1', 'exp-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws NotFoundException when explanation does not exist', async () => {
      mockPrisma.peerExplanation.findUnique.mockResolvedValue(null);
      await expect(service.vote('voter-1', 'exp-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('is idempotent — returns current counts when vote already exists', async () => {
      mockPrisma.vote.findFirst.mockResolvedValue({ id: 'existing' });

      const result = await service.vote('voter-1', 'exp-1');

      expect(result.newUpvotes).toBe(3);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('accrues +1 reputation point to the author', async () => {
      await service.vote('voter-1', 'exp-1');

      expect(mockPrisma.userReputation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_squadId: { userId: 'author-1', squadId: 'squad-1' },
          },
          update: { points: { increment: 1 } },
          create: { userId: 'author-1', squadId: 'squad-1', points: 1 },
        }),
      );
    });

    it('promotes to top and accrues bonus points when threshold crossed', async () => {
      mockPrisma.peerExplanation.findUnique.mockResolvedValue({
        ...explanation,
        upvotes: 4,
      });
      mockPrisma.peerExplanation.update.mockResolvedValue({
        ...explanation,
        upvotes: 5,
      });
      mockPrisma.userReputation.upsert
        .mockResolvedValueOnce({ points: 5 })
        .mockResolvedValueOnce({ points: 7 });

      const result = await service.vote('voter-1', 'exp-1');

      expect(result.isTop).toBe(true);
      expect(mockPrisma.userReputation.upsert).toHaveBeenCalledTimes(2);
    });

    it('awards bronze badge when author reaches 5 points', async () => {
      mockPrisma.userReputation.upsert.mockResolvedValue({
        userId: 'author-1',
        squadId: 'squad-1',
        points: 5,
      });
      mockPrisma.badge.findFirst.mockResolvedValue({
        id: 'badge-bronze',
        name: 'bronze-explainer',
      });

      await service.vote('voter-1', 'exp-1');

      expect(mockPrisma.badgeAward.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_badgeId: { userId: 'author-1', badgeId: 'badge-bronze' },
          },
        }),
      );
    });

    it('awards gold badge (not bronze) when author reaches 50 points', async () => {
      mockPrisma.userReputation.upsert.mockResolvedValue({ points: 50 });
      mockPrisma.badge.findFirst.mockResolvedValue({
        id: 'badge-gold',
        name: 'gold-explainer',
      });

      await service.vote('voter-1', 'exp-1');

      expect(mockPrisma.badge.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { name: 'gold-explainer' } }),
      );
    });
  });

  describe('getLeaderboard', () => {
    it('resolves tier correctly for gold / silver / none', async () => {
      mockPrisma.userReputation.findMany.mockResolvedValue([
        {
          userId: 'u-1',
          squadId: 'squad-1',
          points: 55,
          user: { id: 'u-1', displayName: 'Alice' },
        },
        {
          userId: 'u-2',
          squadId: 'squad-1',
          points: 22,
          user: { id: 'u-2', displayName: 'Bob' },
        },
        {
          userId: 'u-3',
          squadId: 'squad-1',
          points: 3,
          user: { id: 'u-3', displayName: null },
        },
      ]);

      const board = await service.getLeaderboard('squad-1', 10);

      expect(board[0].tier).toBe('gold');
      expect(board[1].tier).toBe('silver');
      expect(board[2].tier).toBe('none');
      expect(board[0].displayName).toBe('Alice');
      expect(board[2].displayName).toBeNull();
    });

    it('passes limit to Prisma findMany', async () => {
      mockPrisma.userReputation.findMany.mockResolvedValue([]);

      await service.getLeaderboard('squad-1', 5);

      expect(mockPrisma.userReputation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });
});
