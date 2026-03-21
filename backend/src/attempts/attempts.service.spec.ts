jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));
import { Test, TestingModule } from '@nestjs/testing';
import { AttemptsService } from './attempts.service';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { ExamsService } from '../exams/exams.service';
import { QuestionType, AttemptStatus } from '@prisma/client';

describe('AttemptsService', () => {
  let service: AttemptsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    examAttempt: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    exam: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    answer: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    examQuestion: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(cb => cb),
  };

  const mockGamificationService = {
    awardPoints: jest.fn(),
  };

  const mockExamsService = {
    updateAvgScore: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttemptsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: GamificationService, useValue: mockGamificationService },
        { provide: ExamsService, useValue: mockExamsService },
      ],
    }).compile();

    service = module.get<AttemptsService>(AttemptsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluateAnswers (Private Logic)', () => {
    it('should correctly evaluate single choice questions', () => {
      const attemptId = 'att-1';
      const dto = {
        answers: [
          { questionId: 'q1', selectedChoices: ['c1'], isMarked: false }
        ]
      };
      const examQuestions = [
        {
          question: {
            id: 'q1',
            questionType: QuestionType.SINGLE,
            choices: [
              { id: 'c1', isCorrect: true },
              { id: 'c2', isCorrect: false }
            ],
            domain: { name: 'Domain A' }
          }
        }
      ];

      // Access private method for testing
      const result = (service as any).evaluateAnswers(attemptId, dto, examQuestions);

      expect(result.totalCorrect).toBe(1);
      expect(result.domainScores['Domain A'].correct).toBe(1);
      expect(result.answerRecords[0].isCorrect).toBe(true);
    });

    it('should correctly evaluate multiple choice questions', () => {
      const attemptId = 'att-1';
      const dto = {
        answers: [
          { questionId: 'q2', selectedChoices: ['c1', 'c2'], isMarked: false }
        ]
      };
      const examQuestions = [
        {
          question: {
            id: 'q2',
            questionType: QuestionType.MULTIPLE,
            choices: [
              { id: 'c1', isCorrect: true },
              { id: 'c2', isCorrect: true },
              { id: 'c3', isCorrect: false }
            ],
            domain: { name: 'Domain B' }
          }
        }
      ];

      const result = (service as any).evaluateAnswers(attemptId, dto, examQuestions);

      expect(result.totalCorrect).toBe(1);
      expect(result.answerRecords[0].isCorrect).toBe(true);
    });

    it('should mark as incorrect if not all correct choices are selected', () => {
      const attemptId = 'att-1';
      const dto = {
        answers: [
          { questionId: 'q2', selectedChoices: ['c1'], isMarked: false }
        ]
      };
      const examQuestions = [
        {
          question: {
            id: 'q2',
            questionType: QuestionType.MULTIPLE,
            choices: [
              { id: 'c1', isCorrect: true },
              { id: 'c2', isCorrect: true }
            ],
            domain: { name: 'Domain B' }
          }
        }
      ];

      const result = (service as any).evaluateAnswers(attemptId, dto, examQuestions);

      expect(result.totalCorrect).toBe(0);
      expect(result.answerRecords[0].isCorrect).toBe(false);
    });
  });
});
