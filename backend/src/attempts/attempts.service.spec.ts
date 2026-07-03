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
    question: {
      findUnique: jest.fn(),
    },
    answer: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
    examQuestion: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb),
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

  describe('start', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('relabels shuffled choices positionally so labels always read a, b, c, d in order', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        title: 'Test Exam',
        certification: { id: 'cert-1' },
        timeLimit: 60,
        timerMode: 'STRICT',
        examQuestions: [
          {
            question: {
              id: 'q1',
              title: 'Q1',
              description: null,
              questionType: 'SINGLE',
              difficulty: 'HARD',
              domain: { id: 'd1', name: 'Domain A' },
              tags: [],
              choices: [
                { id: 'c-orig-a', label: 'a', content: 'Content A' },
                { id: 'c-orig-b', label: 'b', content: 'Content B' },
                { id: 'c-orig-c', label: 'c', content: 'Content C' },
                { id: 'c-orig-d', label: 'd', content: 'Content D' },
              ],
            },
          },
        ],
      });
      mockPrismaService.examAttempt.create.mockResolvedValue({
        id: 'attempt-1',
      });

      const result = await service.start('user-1', 'exam-1');

      const choices = (result.questions[0] as any).choices;
      expect(choices.map((c: any) => c.label)).toEqual(['a', 'b', 'c', 'd']);
      expect(choices.map((c: any) => c.id).sort()).toEqual([
        'c-orig-a',
        'c-orig-b',
        'c-orig-c',
        'c-orig-d',
      ]);
    });
  });

  describe('evaluateAnswers (Private Logic)', () => {
    it('should correctly evaluate single choice questions', () => {
      const attemptId = 'att-1';
      const dto = {
        answers: [
          { questionId: 'q1', selectedChoices: ['c1'], isMarked: false },
        ],
      };
      const examQuestions = [
        {
          question: {
            id: 'q1',
            questionType: QuestionType.SINGLE,
            choices: [
              { id: 'c1', isCorrect: true },
              { id: 'c2', isCorrect: false },
            ],
            domain: { name: 'Domain A' },
          },
        },
      ];

      // Access private method for testing
      const result = (service as any).evaluateAnswers(
        attemptId,
        dto,
        examQuestions,
      );

      expect(result.totalCorrect).toBe(1);
      expect(result.domainScores['Domain A'].correct).toBe(1);
      expect(result.answerRecords[0].isCorrect).toBe(true);
    });

    it('should correctly evaluate multiple choice questions', () => {
      const attemptId = 'att-1';
      const dto = {
        answers: [
          { questionId: 'q2', selectedChoices: ['c1', 'c2'], isMarked: false },
        ],
      };
      const examQuestions = [
        {
          question: {
            id: 'q2',
            questionType: QuestionType.MULTIPLE,
            choices: [
              { id: 'c1', isCorrect: true },
              { id: 'c2', isCorrect: true },
              { id: 'c3', isCorrect: false },
            ],
            domain: { name: 'Domain B' },
          },
        },
      ];

      const result = (service as any).evaluateAnswers(
        attemptId,
        dto,
        examQuestions,
      );

      expect(result.totalCorrect).toBe(1);
      expect(result.answerRecords[0].isCorrect).toBe(true);
    });

    it('should mark as incorrect if not all correct choices are selected', () => {
      const attemptId = 'att-1';
      const dto = {
        answers: [
          { questionId: 'q2', selectedChoices: ['c1'], isMarked: false },
        ],
      };
      const examQuestions = [
        {
          question: {
            id: 'q2',
            questionType: QuestionType.MULTIPLE,
            choices: [
              { id: 'c1', isCorrect: true },
              { id: 'c2', isCorrect: true },
            ],
            domain: { name: 'Domain B' },
          },
        },
      ];

      const result = (service as any).evaluateAnswers(
        attemptId,
        dto,
        examQuestions,
      );

      expect(result.totalCorrect).toBe(0);
      expect(result.answerRecords[0].isCorrect).toBe(false);
    });

    it('orders answerRecords by the order the client submitted them, not exam-question fetch order', () => {
      const attemptId = 'att-1';
      // dto.answers mirrors the randomized per-attempt order the user was
      // shown (q3, then q1, then q2) — see AttemptsService.start().
      const dto = {
        answers: [
          { questionId: 'q3', selectedChoices: ['c3a'], isMarked: false },
          { questionId: 'q1', selectedChoices: ['c1a'], isMarked: false },
          { questionId: 'q2', selectedChoices: ['c2a'], isMarked: false },
        ],
      };
      // examQuestions comes back in canonical (unrelated) DB order.
      const examQuestions = [
        {
          question: {
            id: 'q1',
            choices: [{ id: 'c1a', isCorrect: true }],
            domain: { name: 'Domain A' },
          },
        },
        {
          question: {
            id: 'q2',
            choices: [{ id: 'c2a', isCorrect: true }],
            domain: { name: 'Domain A' },
          },
        },
        {
          question: {
            id: 'q3',
            choices: [{ id: 'c3a', isCorrect: true }],
            domain: { name: 'Domain A' },
          },
        },
      ];

      const result = (service as any).evaluateAnswers(
        attemptId,
        dto,
        examQuestions,
      );

      expect(result.answerRecords.map((r: any) => r.questionId)).toEqual([
        'q3',
        'q1',
        'q2',
      ]);
      expect(result.answerRecords.map((r: any) => r.questionOrder)).toEqual([
        0, 1, 2,
      ]);
    });

    it('appends questions missing from the submitted payload instead of dropping them', () => {
      const attemptId = 'att-1';
      const dto = {
        answers: [
          { questionId: 'q1', selectedChoices: ['c1a'], isMarked: false },
        ],
      };
      const examQuestions = [
        {
          question: {
            id: 'q1',
            choices: [{ id: 'c1a', isCorrect: true }],
            domain: { name: 'Domain A' },
          },
        },
        {
          question: {
            id: 'q2',
            choices: [{ id: 'c2a', isCorrect: true }],
            domain: { name: 'Domain A' },
          },
        },
      ];

      const result = (service as any).evaluateAnswers(
        attemptId,
        dto,
        examQuestions,
      );

      expect(result.answerRecords).toHaveLength(2);
      expect(result.answerRecords[1].questionId).toBe('q2');
      expect(result.answerRecords[1].questionOrder).toBe(1);
      expect(result.answerRecords[1].selectedChoices).toEqual([]);
    });

    it('ignores duplicate questionIds in the submitted payload instead of double-counting them', () => {
      const attemptId = 'att-1';
      const dto = {
        answers: [
          { questionId: 'q1', selectedChoices: ['c1a'], isMarked: false },
          { questionId: 'q1', selectedChoices: ['c1a'], isMarked: false },
          { questionId: 'q1', selectedChoices: ['c1a'], isMarked: false },
        ],
      };
      const examQuestions = [
        {
          question: {
            id: 'q1',
            choices: [{ id: 'c1a', isCorrect: true }],
            domain: { name: 'Domain A' },
          },
        },
      ];

      const result = (service as any).evaluateAnswers(
        attemptId,
        dto,
        examQuestions,
      );

      expect(result.answerRecords).toHaveLength(1);
      expect(result.totalCorrect).toBe(1);
      expect(result.domainScores['Domain A']).toEqual({ correct: 1, total: 1 });
    });
  });

  describe('saveAnswer', () => {
    const userId = 'user-1';
    const attemptId = 'att-1';

    beforeEach(() => {
      jest.clearAllMocks();
      mockPrismaService.examAttempt.findUnique.mockResolvedValue({
        id: attemptId,
        userId,
        status: AttemptStatus.IN_PROGRESS,
      });
      mockPrismaService.question.findUnique.mockResolvedValue({
        id: 'q1',
        choices: [
          { id: 'c1', isCorrect: true },
          { id: 'c2', isCorrect: false },
        ],
      });
    });

    it('stamps a new answer with the current answer count as its questionOrder', async () => {
      mockPrismaService.answer.findFirst.mockResolvedValue(null);
      mockPrismaService.answer.count.mockResolvedValue(2);

      await service.saveAnswer(userId, attemptId, {
        questionId: 'q1',
        selectedChoices: ['c1'],
      });

      expect(mockPrismaService.answer.count).toHaveBeenCalledWith({
        where: { attemptId },
      });
      expect(mockPrismaService.answer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ questionOrder: 2 }),
        }),
      );
    });

    it('does not recompute questionOrder when updating an existing answer', async () => {
      mockPrismaService.answer.findFirst.mockResolvedValue({ id: 'ans-1' });

      await service.saveAnswer(userId, attemptId, {
        questionId: 'q1',
        selectedChoices: ['c2'],
      });

      expect(mockPrismaService.answer.count).not.toHaveBeenCalled();
      const call = mockPrismaService.answer.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'ans-1' });
      expect(call.update).not.toHaveProperty('questionOrder');
    });
  });
});
