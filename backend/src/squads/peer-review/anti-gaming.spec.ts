import { Test, TestingModule } from '@nestjs/testing';
import { PeerReviewService } from './peer-review.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const now = new Date('2026-06-23T10:00:00Z');

const mockPrisma = {
  question: { findUnique: jest.fn() },
  organization: { findUnique: jest.fn() },
  peerExplanation: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  vote: {
    findFirst: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  userReputation: { upsert: jest.fn() },
  badge: { findFirst: jest.fn() },
  badgeAward: { upsert: jest.fn() },
  reputationFlag: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('PeerReviewService — anti-gaming (US-1102)', () => {
  let service: PeerReviewService;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

    delete process.env.REPUTATION_VELOCITY_WINDOW_MS;
    delete process.env.REPUTATION_VELOCITY_BURST_THRESHOLD;
    delete process.env.REPUTATION_RING_THRESHOLD;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeerReviewService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(PeerReviewService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── velocity_burst detection ──────────────────────────────────────────────

  describe('velocity_burst detection', () => {
    const explanation = {
      id: 'exp-1',
      questionId: 'q-1',
      squadId: 'squad-1',
      authorId: 'author-1',
      upvotes: 2,
      isTop: false,
      content: 'good explanation',
      createdAt: now,
      updatedAt: now,
    };

    beforeEach(() => {
      mockPrisma.peerExplanation.findUnique.mockResolvedValue(explanation);
      mockPrisma.vote.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation((ops) => Promise.all(ops));
      mockPrisma.vote.create.mockResolvedValue({});
      mockPrisma.peerExplanation.update.mockResolvedValue({
        ...explanation,
        upvotes: 3,
      });
    });

    it('creates a reputation flag and skips accrual when burst threshold exceeded', async () => {
      process.env.REPUTATION_VELOCITY_BURST_THRESHOLD = '5';
      process.env.REPUTATION_VELOCITY_WINDOW_MS = '60000';

      mockPrisma.vote.count
        .mockResolvedValueOnce(5) // velocity_burst count at threshold
        .mockResolvedValueOnce(0); // ring (not reached in this path)

      mockPrisma.peerExplanation.findMany.mockResolvedValue([]);
      mockPrisma.reputationFlag.create.mockResolvedValue({ id: 'flag-1' });

      const result = await service.vote('voter-1', 'exp-1');

      expect(mockPrisma.reputationFlag.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: 'velocity_burst',
            voterId: 'voter-1',
            explanationId: 'exp-1',
            squadId: 'squad-1',
            status: 'pending',
          }),
        }),
      );
      expect(mockPrisma.userReputation.upsert).not.toHaveBeenCalled();
      expect(result.newUpvotes).toBe(3);
    });

    it('does not flag when burst count is below threshold', async () => {
      process.env.REPUTATION_VELOCITY_BURST_THRESHOLD = '5';
      process.env.REPUTATION_VELOCITY_WINDOW_MS = '60000';

      mockPrisma.vote.count
        .mockResolvedValueOnce(3) // 3 < 5 → safe
        .mockResolvedValueOnce(0);

      mockPrisma.peerExplanation.findMany.mockResolvedValue([]);
      mockPrisma.peerExplanation.update.mockResolvedValue({
        ...explanation,
        upvotes: 3,
      });
      mockPrisma.userReputation.upsert.mockResolvedValue({ points: 1 });
      mockPrisma.badge.findFirst.mockResolvedValue(null);

      await service.vote('voter-1', 'exp-1');

      expect(mockPrisma.reputationFlag.create).not.toHaveBeenCalled();
      expect(mockPrisma.userReputation.upsert).toHaveBeenCalled();
    });
  });

  // ─── vote_ring detection ───────────────────────────────────────────────────

  describe('vote_ring detection', () => {
    const explanation = {
      id: 'exp-2',
      questionId: 'q-2',
      squadId: 'squad-1',
      authorId: 'author-2',
      upvotes: 1,
      isTop: false,
      content: 'another explanation',
      createdAt: now,
      updatedAt: now,
    };

    beforeEach(() => {
      mockPrisma.peerExplanation.findUnique.mockResolvedValue(explanation);
      mockPrisma.vote.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation((ops) => Promise.all(ops));
      mockPrisma.vote.create.mockResolvedValue({});
      mockPrisma.peerExplanation.update.mockResolvedValue({
        ...explanation,
        upvotes: 2,
      });
    });

    it('creates a vote_ring flag when voter has voted on many explanations by the same author', async () => {
      process.env.REPUTATION_VELOCITY_BURST_THRESHOLD = '10';
      process.env.REPUTATION_RING_THRESHOLD = '3';

      mockPrisma.vote.count
        .mockResolvedValueOnce(1) // burst: 1 < 10 → safe
        .mockResolvedValueOnce(3); // ring: 3 >= 3 → flag

      mockPrisma.peerExplanation.findMany.mockResolvedValue([
        { id: 'exp-a' },
        { id: 'exp-b' },
        { id: 'exp-c' },
      ]);
      mockPrisma.reputationFlag.create.mockResolvedValue({ id: 'flag-2' });

      await service.vote('voter-ring', 'exp-2');

      expect(mockPrisma.reputationFlag.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: 'vote_ring',
            voterId: 'voter-ring',
          }),
        }),
      );
      expect(mockPrisma.userReputation.upsert).not.toHaveBeenCalled();
    });

    it('skips ring cross-vote count when author has no other explanations in squad', async () => {
      process.env.REPUTATION_VELOCITY_BURST_THRESHOLD = '10';
      process.env.REPUTATION_RING_THRESHOLD = '3';

      mockPrisma.vote.count.mockResolvedValueOnce(1); // burst check only

      // No other explanations → ring check short-circuits
      mockPrisma.peerExplanation.findMany.mockResolvedValue([]);
      mockPrisma.peerExplanation.update.mockResolvedValue({
        ...explanation,
        upvotes: 2,
      });
      mockPrisma.userReputation.upsert.mockResolvedValue({ points: 1 });
      mockPrisma.badge.findFirst.mockResolvedValue(null);

      await service.vote('voter-1', 'exp-2');

      expect(mockPrisma.reputationFlag.create).not.toHaveBeenCalled();
      expect(mockPrisma.vote.count).toHaveBeenCalledTimes(1);
    });
  });

  // ─── resolveFlag (US-1102) ────────────────────────────────────────────────

  describe('resolveFlag', () => {
    const pendingFlag = {
      id: 'flag-1',
      flaggedUserId: 'author-1',
      voterId: 'voter-1',
      explanationId: 'exp-1',
      squadId: 'squad-1',
      reason: 'velocity_burst',
      pointsHeld: 1,
      status: 'pending',
      createdAt: now,
      resolvedAt: null,
    };

    it('releases withheld points when flag is cleared', async () => {
      mockPrisma.reputationFlag.findUnique.mockResolvedValue(pendingFlag);
      mockPrisma.reputationFlag.update.mockResolvedValue({
        ...pendingFlag,
        status: 'cleared',
        resolvedAt: now,
      });
      mockPrisma.userReputation.upsert.mockResolvedValue({ points: 2 });

      const result = await service.resolveFlag('flag-1', 'cleared');

      expect(mockPrisma.userReputation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_squadId: { userId: 'author-1', squadId: 'squad-1' } },
          update: { points: { increment: 1 } },
        }),
      );
      expect(result.status).toBe('cleared');
    });

    it('does not release points when flag is confirmed', async () => {
      mockPrisma.reputationFlag.findUnique.mockResolvedValue(pendingFlag);
      mockPrisma.reputationFlag.update.mockResolvedValue({
        ...pendingFlag,
        status: 'confirmed',
        resolvedAt: now,
      });

      const result = await service.resolveFlag('flag-1', 'confirmed');

      expect(mockPrisma.userReputation.upsert).not.toHaveBeenCalled();
      expect(result.status).toBe('confirmed');
    });

    it('throws NotFoundException when flag does not exist', async () => {
      mockPrisma.reputationFlag.findUnique.mockResolvedValue(null);

      await expect(service.resolveFlag('missing', 'cleared')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when flag is already resolved', async () => {
      mockPrisma.reputationFlag.findUnique.mockResolvedValue({
        ...pendingFlag,
        status: 'confirmed',
      });

      await expect(service.resolveFlag('flag-1', 'cleared')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── listFlags (US-1102) ──────────────────────────────────────────────────

  describe('listFlags', () => {
    it('returns flags for a squad without status filter', async () => {
      const flags = [
        {
          id: 'f1',
          flaggedUserId: 'u1',
          voterId: 'v1',
          explanationId: 'e1',
          squadId: 'squad-1',
          reason: 'velocity_burst',
          pointsHeld: 1,
          status: 'pending',
          createdAt: now,
          resolvedAt: null,
        },
      ];
      mockPrisma.reputationFlag.findMany.mockResolvedValue(flags);

      const result = await service.listFlags('squad-1');

      expect(mockPrisma.reputationFlag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { squadId: 'squad-1' } }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].reason).toBe('velocity_burst');
    });

    it('passes status filter to the query', async () => {
      mockPrisma.reputationFlag.findMany.mockResolvedValue([]);

      await service.listFlags('squad-1', 'pending');

      expect(mockPrisma.reputationFlag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { squadId: 'squad-1', status: 'pending' },
        }),
      );
    });
  });
});
