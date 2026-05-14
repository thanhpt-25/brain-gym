import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NextTopicService } from './next-topic.service';

describe('NextTopicService', () => {
  let service: NextTopicService;
  let prisma: PrismaService;

  const mockUserId = 'user-1';
  const mockCertId = 'cert-1';

  const mockDomain1 = {
    id: 'domain-1',
    name: 'Authentication',
    certificationId: mockCertId,
  };

  const mockDomain2 = {
    id: 'domain-2',
    name: 'Security',
    certificationId: mockCertId,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NextTopicService,
        {
          provide: PrismaService,
          useValue: {
            certification: {
              findUnique: jest.fn(),
            },
            answer: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
            question: {
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<NextTopicService>(NextTopicService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('suggestNextTopic', () => {
    it('should return suggestion for weakest domain with ≥10 attempts', async () => {
      // Arrange: Domain 1 has lowest accuracy (75%), domain 2 has higher (85%)
      const certWithDomains = {
        id: mockCertId,
        domains: [mockDomain1, mockDomain2],
      };

      // Mock domain 1 answers: 11 correct out of 15 = 73% accuracy
      const domain1Answers = Array(15)
        .fill(null)
        .map((_, i) => ({
          questionId: `q${i + 1}`,
          isCorrect: i < 11,
          attempt: { submittedAt: new Date('2026-05-10') },
        }));

      // Mock domain 2 answers: 15 correct out of 15 = 100% accuracy
      const domain2Answers = Array(15)
        .fill(null)
        .map((_, i) => ({
          questionId: `q${i + 1}`,
          isCorrect: true,
          attempt: { submittedAt: new Date('2026-05-12') },
        }));

      const wrongQuestionSample = { questionId: 'q12' };
      const fallbackQuestion = { id: 'q1' };

      jest
        .spyOn(prisma.certification, 'findUnique')
        .mockResolvedValue(certWithDomains as any);

      jest.spyOn(prisma.answer, 'findMany').mockImplementation((query: any) => {
        if (query.where.question.domainId === 'domain-1') {
          return Promise.resolve(domain1Answers);
        }
        return Promise.resolve(domain2Answers);
      });

      jest
        .spyOn(prisma.answer, 'findFirst')
        .mockResolvedValue(wrongQuestionSample as any);

      // Act
      const result = await service.suggestNextTopic(mockUserId, mockCertId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.domain.id).toBe('domain-1');
      expect(result?.accuracy).toBe(73);
      expect(result?.sampleQuestionId).toBe('q12');
      expect(result?.reason).toContain('73%');
    });

    it('should return null when all domains have >80% accuracy (well-rounded)', async () => {
      // Arrange: All domains above 80% threshold
      const certWithDomains = {
        id: mockCertId,
        domains: [mockDomain1, mockDomain2],
      };

      // Mock high accuracy answers
      const highAccuracyAnswers = Array(12)
        .fill(null)
        .map((_, i) => ({
          questionId: `q${i + 1}`,
          isCorrect: i < 11, // 11/12 = 91%
          attempt: { submittedAt: new Date('2026-05-12') },
        }));

      jest
        .spyOn(prisma.certification, 'findUnique')
        .mockResolvedValue(certWithDomains as any);

      jest
        .spyOn(prisma.answer, 'findMany')
        .mockResolvedValue(highAccuracyAnswers as any);

      // Act
      const result = await service.suggestNextTopic(mockUserId, mockCertId);

      // Assert
      expect(result).toBeNull();
    });

    it('should filter out domains with <10 attempts', async () => {
      // Arrange: Domain 1 has low attempts (8), domain 2 has sufficient (12)
      const certWithDomains = {
        id: mockCertId,
        domains: [mockDomain1, mockDomain2],
      };

      // Mock domain 1 with only 8 answers (should be filtered out)
      const domain1FewAnswers = Array(8)
        .fill(null)
        .map((_, i) => ({
          questionId: `q${i + 1}`,
          isCorrect: i < 4, // 4/8 = 50%
          attempt: { submittedAt: new Date('2026-05-10') },
        }));

      // Mock domain 2 with 12 answers and 75% accuracy
      const domain2Answers = Array(12)
        .fill(null)
        .map((_, i) => ({
          questionId: `q${i + 1}`,
          isCorrect: i < 9, // 9/12 = 75%
          attempt: { submittedAt: new Date('2026-05-11') },
        }));

      const wrongQuestionSample = { questionId: 'q10' };

      jest
        .spyOn(prisma.certification, 'findUnique')
        .mockResolvedValue(certWithDomains as any);

      jest.spyOn(prisma.answer, 'findMany').mockImplementation((query: any) => {
        if (query.where.question.domainId === 'domain-1') {
          return Promise.resolve(domain1FewAnswers);
        }
        return Promise.resolve(domain2Answers);
      });

      jest
        .spyOn(prisma.answer, 'findFirst')
        .mockResolvedValue(wrongQuestionSample as any);

      // Act
      const result = await service.suggestNextTopic(mockUserId, mockCertId);

      // Assert: Domain 2 should be selected (domain 1 filtered out for <10 attempts)
      expect(result?.domain.id).toBe('domain-2');
      expect(result?.accuracy).toBe(75);
    });

    it('should tie-break by oldest lastSeenAt when accuracies equal', async () => {
      // Arrange: Two domains with same accuracy (below 80%), different timestamps
      const certWithDomains = {
        id: mockCertId,
        domains: [mockDomain1, mockDomain2],
      };

      // Both domains have 9/12 = 75% accuracy (below 80% threshold)
      const domain1Answers = Array(12)
        .fill(null)
        .map((_, i) => ({
          questionId: `q${i + 1}`,
          isCorrect: i < 9,
          attempt: { submittedAt: new Date('2026-05-08') }, // Older
        }));

      const domain2Answers = Array(12)
        .fill(null)
        .map((_, i) => ({
          questionId: `q${i + 1}`,
          isCorrect: i < 9,
          attempt: { submittedAt: new Date('2026-05-12') }, // Newer
        }));

      const wrongQuestionSample = { questionId: 'q10' };

      jest
        .spyOn(prisma.certification, 'findUnique')
        .mockResolvedValue(certWithDomains as any);

      jest.spyOn(prisma.answer, 'findMany').mockImplementation((query: any) => {
        if (query.where.question.domainId === 'domain-1') {
          return Promise.resolve(domain1Answers);
        }
        return Promise.resolve(domain2Answers);
      });

      jest
        .spyOn(prisma.answer, 'findFirst')
        .mockResolvedValue(wrongQuestionSample as any);

      // Act
      const result = await service.suggestNextTopic(mockUserId, mockCertId);

      // Assert: Domain 1 should win tie-breaker (older lastSeenAt = 2026-05-08)
      expect(result?.domain.id).toBe('domain-1');
      expect(result?.accuracy).toBe(75);
    });

    it('should use fallback question when no wrong answers exist', async () => {
      // Arrange: Domain with low accuracy but recently all answered correctly
      const certWithDomains = {
        id: mockCertId,
        domains: [mockDomain1],
      };

      // 7 correct out of 12 = 58% accuracy (below 80%)
      const mixedAnswers = Array(12)
        .fill(null)
        .map((_, i) => ({
          questionId: `q${i + 1}`,
          isCorrect: i < 7, // First 7 correct, last 5 wrong
          attempt: { submittedAt: new Date('2026-05-10') },
        }));

      const fallbackQuestion = { id: 'q1' };

      jest
        .spyOn(prisma.certification, 'findUnique')
        .mockResolvedValue(certWithDomains as any);

      jest
        .spyOn(prisma.answer, 'findMany')
        .mockResolvedValue(mixedAnswers as any);

      // findFirst for wrong answers returns null (simulate no recent wrong answers)
      jest.spyOn(prisma.answer, 'findFirst').mockResolvedValue(null);

      jest
        .spyOn(prisma.question, 'findFirst')
        .mockResolvedValue(fallbackQuestion as any);

      // Act
      const result = await service.suggestNextTopic(mockUserId, mockCertId);

      // Assert: Should use fallback question since no wrong answers found
      expect(result?.sampleQuestionId).toBe('q1');
      expect(result?.accuracy).toBe(58);
      expect(prisma.question.findFirst).toHaveBeenCalled();
    });

    it('should return null when certification has no domains', async () => {
      // Arrange: Certification exists but has no domains
      const certNoDomains = {
        id: mockCertId,
        domains: [],
      };

      jest
        .spyOn(prisma.certification, 'findUnique')
        .mockResolvedValue(certNoDomains as any);

      // Act
      const result = await service.suggestNextTopic(mockUserId, mockCertId);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when certification not found', async () => {
      // Arrange
      jest
        .spyOn(prisma.certification, 'findUnique')
        .mockResolvedValue(null as any);

      // Act
      const result = await service.suggestNextTopic(mockUserId, mockCertId);

      // Assert
      expect(result).toBeNull();
    });

    it('should include correct domain name in suggestion', async () => {
      // Arrange
      const certWithDomains = {
        id: mockCertId,
        domains: [mockDomain1],
      };

      const domainAnswers = Array(10)
        .fill(null)
        .map((_, i) => ({
          questionId: `q${i + 1}`,
          isCorrect: i < 7, // 70%
          attempt: { submittedAt: new Date('2026-05-10') },
        }));

      const wrongQuestionSample = { questionId: 'q8' };

      jest
        .spyOn(prisma.certification, 'findUnique')
        .mockResolvedValue(certWithDomains as any);

      jest
        .spyOn(prisma.answer, 'findMany')
        .mockResolvedValue(domainAnswers as any);

      jest
        .spyOn(prisma.answer, 'findFirst')
        .mockResolvedValue(wrongQuestionSample as any);

      // Act
      const result = await service.suggestNextTopic(mockUserId, mockCertId);

      // Assert
      expect(result?.domain.name).toBe('Authentication');
    });
  });
});
