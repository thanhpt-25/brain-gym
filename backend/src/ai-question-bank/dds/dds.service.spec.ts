import { Test, TestingModule } from '@nestjs/testing';
import { DdsService } from './dds.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../llm/llm.service';

describe('DdsService', () => {
  let service: DdsService;
  let prisma: PrismaService;
  let llm: LlmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DdsService,
        {
          provide: PrismaService,
          useValue: {
            questionVariant: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            question: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: LlmService,
          useValue: {
            generateDistracterVariant: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DdsService>(DdsService);
    prisma = module.get<PrismaService>(PrismaService);
    llm = module.get<LlmService>(LlmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPendingVariants', () => {
    it('should return pending variants sorted by createdAt', async () => {
      const mockVariants = [
        {
          id: 'var-1',
          questionId: 'q-1',
          status: 'PENDING',
          reason: 'Test reason',
          diff: {
            originalChoices: [],
            revisedChoices: [],
          },
          createdAt: new Date(),
        },
      ];

      jest
        .spyOn(prisma.questionVariant, 'findMany')
        .mockResolvedValue(mockVariants as any);

      const result = await service.getPendingVariants(20);

      expect(result).toEqual(mockVariants);
      expect(prisma.questionVariant.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });
  });

  describe('approveVariant', () => {
    it('should approve a variant and update question', async () => {
      const variantId = 'var-1';
      const questionId = 'q-1';

      jest.spyOn(prisma.questionVariant, 'findUnique').mockResolvedValue({
        id: variantId,
        questionId,
        status: 'PENDING',
        diff: {
          originalChoices: [],
          revisedChoices: [
            { label: 'A', content: 'New distracter', isCorrect: false },
          ],
        },
      } as any);

      jest.spyOn(prisma.questionVariant, 'update').mockResolvedValue({
        id: variantId,
        status: 'APPROVED',
      } as any);

      const result = await service.approveVariant(variantId, 'Looks good');

      expect(result.status).toBe('APPROVED');
      expect(prisma.questionVariant.update).toHaveBeenCalled();
    });
  });

  describe('rejectVariant', () => {
    it('should reject a variant', async () => {
      const variantId = 'var-1';

      jest.spyOn(prisma.questionVariant, 'update').mockResolvedValue({
        id: variantId,
        status: 'REJECTED',
      } as any);

      const result = await service.rejectVariant(variantId, 'Not good enough');

      expect(result.status).toBe('REJECTED');
      expect(prisma.questionVariant.update).toHaveBeenCalledWith({
        where: { id: variantId },
        data: {
          status: 'REJECTED',
          reviewNote: 'Not good enough',
        },
      });
    });
  });
});
