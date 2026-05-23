import { Test, TestingModule } from '@nestjs/testing';
import { PeerReviewService } from './peer-review.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PeerReviewService', () => {
  let service: PeerReviewService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeerReviewService,
        {
          provide: PrismaService,
          useValue: {
            peerExplanation: {
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            peerVote: {
              findFirst: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PeerReviewService>(PeerReviewService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getExplanations', () => {
    it('should return explanations sorted by top first, then by upvotes', async () => {
      const mockExplanations = [
        {
          id: 'exp-1',
          questionId: 'q-1',
          squadId: 'squad-1',
          authorId: 'user-1',
          content: 'Top explanation',
          upvotes: 6,
          isTop: true,
          createdAt: new Date(),
        },
        {
          id: 'exp-2',
          questionId: 'q-1',
          squadId: 'squad-1',
          authorId: 'user-2',
          content: 'Good explanation',
          upvotes: 3,
          isTop: false,
          createdAt: new Date(),
        },
      ];

      jest
        .spyOn(prisma.peerExplanation, 'findMany')
        .mockResolvedValue(mockExplanations as any);

      const result = await service.getExplanations('q-1', 'squad-1');

      expect(result).toEqual(mockExplanations);
      expect(result[0].isTop).toBe(true);
      expect(result[1].upvotes).toBeLessThan(result[0].upvotes);
    });
  });

  describe('submitExplanation', () => {
    it('should create a new peer explanation', async () => {
      const mockExplanation = {
        id: 'exp-1',
        questionId: 'q-1',
        squadId: 'squad-1',
        authorId: 'user-1',
        content: 'My explanation',
        upvotes: 0,
        isTop: false,
        createdAt: new Date(),
      };

      jest
        .spyOn(prisma.peerExplanation, 'create')
        .mockResolvedValue(mockExplanation as any);

      const result = await service.submitExplanation(
        'q-1',
        'squad-1',
        'user-1',
        'My explanation',
      );

      expect(result.id).toBe('exp-1');
      expect(result.content).toBe('My explanation');
      expect(prisma.peerExplanation.create).toHaveBeenCalled();
    });
  });

  describe('voteOnExplanation', () => {
    it('should toggle vote on explanation and update isTop if >= 5 upvotes', async () => {
      const explanationId = 'exp-1';
      const userId = 'user-1';

      jest.spyOn(prisma.peerVote, 'findFirst').mockResolvedValue(null as any);

      jest.spyOn(prisma.peerVote, 'create').mockResolvedValue({
        id: 'vote-1',
        explanationId,
        userId,
      } as any);

      jest.spyOn(prisma.peerExplanation, 'update').mockResolvedValue({
        id: explanationId,
        upvotes: 5,
        isTop: true,
      } as any);

      const result = await service.voteOnExplanation(explanationId, userId);

      expect(result.upvotes).toBe(5);
      expect(result.isTop).toBe(true);
    });

    it('should prevent self-voting', async () => {
      const explanationId = 'exp-1';
      const authorId = 'user-1';

      jest.spyOn(prisma.peerExplanation, 'findMany').mockResolvedValue([
        {
          id: explanationId,
          authorId,
        },
      ] as any);

      expect(async () => {
        await service.voteOnExplanation(explanationId, authorId);
      }).rejects.toThrow('Cannot vote on own explanation');
    });
  });
});
