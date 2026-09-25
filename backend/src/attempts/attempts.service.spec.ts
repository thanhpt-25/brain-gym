jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));
import { Test, TestingModule } from '@nestjs/testing';
import { AttemptsService } from './attempts.service';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { ExamsService } from '../exams/exams.service';
import { QuestionType, AttemptStatus, FeedbackMode } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { isAnswerCorrect } from './grading';

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
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
    examQuestion: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
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
  describe('saveAnswer on a checked (locked) answer', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockPrismaService.examAttempt.findUnique.mockResolvedValue({
        id: 'att-1',
        userId: 'user-1',
        status: AttemptStatus.IN_PROGRESS,
      });
      mockPrismaService.question.findUnique.mockResolvedValue({
        id: 'q1',
        choices: [{ id: 'c1', isCorrect: true }],
      });
    });

    it('rejects with 409 instead of overwriting the revealed answer', async () => {
      mockPrismaService.answer.findFirst.mockResolvedValue({
        id: 'ans-1',
        checkedAt: new Date(),
      });

      await expect(
        service.saveAnswer('user-1', 'att-1', {
          questionId: 'q1',
          selectedChoices: ['c1'],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockPrismaService.answer.upsert).not.toHaveBeenCalled();
    });

    it('rejects INTERACTIVE attempts, which must use /check', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue({
        id: 'att-1',
        userId: 'user-1',
        status: AttemptStatus.IN_PROGRESS,
        feedbackMode: FeedbackMode.INTERACTIVE,
      });

      await expect(
        service.saveAnswer('user-1', 'att-1', {
          questionId: 'q1',
          selectedChoices: ['c1'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaService.answer.upsert).not.toHaveBeenCalled();
    });
  });

  describe('isAnswerCorrect', () => {
    it.each([
      [['a'], ['a'], true],
      [['a', 'b'], ['b', 'a'], true],
      [['a', 'b'], ['a'], false],
      [['a'], ['a', 'b'], false],
      [['a'], [], false],
      [['a'], ['b'], false],
    ])('correct=%j selected=%j → %s', (correct, selected, expected) => {
      expect(isAnswerCorrect(correct, selected)).toBe(expected);
    });
  });

  describe('start with feedbackMode', () => {
    const baseExam = {
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
            explanation: 'secret explanation',
            questionType: 'SINGLE',
            difficulty: 'EASY',
            domain: null,
            tags: [],
            choices: [
              { id: 'c1', label: 'a', content: 'A', isCorrect: true },
              { id: 'c2', label: 'b', content: 'B', isCorrect: false },
            ],
          },
        },
      ],
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockPrismaService.examAttempt.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'attempt-1', feedbackMode: data.feedbackMode }),
      );
    });

    it('defaults to END_OF_EXAM when no mode is given', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(baseExam);

      const result = await service.start('user-1', 'exam-1');

      expect(mockPrismaService.examAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          feedbackMode: FeedbackMode.END_OF_EXAM,
        }),
      });
      expect(result.feedbackMode).toBe(FeedbackMode.END_OF_EXAM);
    });

    it('stores INTERACTIVE and still hides answers and explanations', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(baseExam);

      const result = await service.start(
        'user-1',
        'exam-1',
        FeedbackMode.INTERACTIVE,
      );

      expect(result.feedbackMode).toBe(FeedbackMode.INTERACTIVE);
      const q = result.questions[0] as any;
      expect(q).not.toHaveProperty('explanation');
      q.choices.forEach((c: any) => expect(c).not.toHaveProperty('isCorrect'));
    });

    it('rejects INTERACTIVE for Time Pressure exams', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({
        ...baseExam,
        timerMode: 'TIME_PRESSURE',
      });

      await expect(
        service.start('user-1', 'exam-1', FeedbackMode.INTERACTIVE),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaService.examAttempt.create).not.toHaveBeenCalled();
    });
  });

  describe('checkAnswer', () => {
    const userId = 'user-1';
    const attemptId = 'att-1';
    const tx = {
      $queryRaw: jest.fn(),
      answer: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
    };
    const interactiveAttempt = {
      id: attemptId,
      userId,
      examId: 'exam-1',
      status: AttemptStatus.IN_PROGRESS,
      feedbackMode: FeedbackMode.INTERACTIVE,
    };
    const examQuestion = {
      question: {
        id: 'q1',
        explanation: 'Because **B** is right.',
        choices: [
          { id: 'c1', isCorrect: false },
          { id: 'c2', isCorrect: true },
          { id: 'c3', isCorrect: true },
        ],
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockPrismaService.examAttempt.findUnique.mockResolvedValue(
        interactiveAttempt,
      );
      mockPrismaService.examQuestion.findFirst.mockResolvedValue(examQuestion);
      mockPrismaService.$transaction.mockImplementation((arg: any) =>
        typeof arg === 'function' ? arg(tx) : arg,
      );
      tx.$queryRaw.mockResolvedValue([{ status: AttemptStatus.IN_PROGRESS }]);
      tx.answer.findFirst.mockResolvedValue(null);
      tx.answer.count.mockResolvedValue(3);
    });

    afterAll(() => {
      mockPrismaService.$transaction.mockImplementation((cb: any) => cb);
    });

    const check = (selectedChoices: string[], questionId = 'q1') =>
      service.checkAnswer(userId, attemptId, { questionId, selectedChoices });

    it('returns correct result, correct choices and explanation, and locks the answer', async () => {
      const res = await check(['c3', 'c2']);

      expect(res).toEqual(
        expect.objectContaining({
          questionId: 'q1',
          isCorrect: true,
          selectedChoiceIds: ['c3', 'c2'],
          correctChoiceIds: ['c2', 'c3'],
          explanation: 'Because **B** is right.',
        }),
      );
      expect(res.checkedAt).toBeInstanceOf(Date);
      expect(tx.answer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          attemptId,
          questionId: 'q1',
          isCorrect: true,
          questionOrder: 3,
          checkedAt: res.checkedAt,
        }),
      });
    });

    it('reports incorrect when a MULTIPLE answer is incomplete', async () => {
      const res = await check(['c2']);
      expect(res.isCorrect).toBe(false);
      expect(res.correctChoiceIds).toEqual(['c2', 'c3']);
    });

    it('reports incorrect when a MULTIPLE answer has an extra choice', async () => {
      const res = await check(['c1', 'c2', 'c3']);
      expect(res.isCorrect).toBe(false);
    });

    it('returns null explanation when the question has none', async () => {
      mockPrismaService.examQuestion.findFirst.mockResolvedValue({
        question: { ...examQuestion.question, explanation: null },
      });
      const res = await check(['c2', 'c3']);
      expect(res.explanation).toBeNull();
    });

    it('updates a previously saved (unchecked) answer instead of creating a duplicate', async () => {
      tx.answer.findFirst.mockResolvedValue({ id: 'ans-1', checkedAt: null });

      await check(['c1']);

      expect(tx.answer.create).not.toHaveBeenCalled();
      expect(tx.answer.update).toHaveBeenCalledWith({
        where: { id: 'ans-1' },
        data: expect.objectContaining({
          selectedChoices: ['c1'],
          isCorrect: false,
          checkedAt: expect.any(Date),
        }),
      });
    });

    it('404 when the attempt does not exist', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue(null);
      await expect(check(['c2'])).rejects.toBeInstanceOf(NotFoundException);
    });

    it("403 on another user's attempt", async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue({
        ...interactiveAttempt,
        userId: 'someone-else',
      });
      await expect(check(['c2'])).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('400 once the attempt is submitted', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue({
        ...interactiveAttempt,
        status: AttemptStatus.SUBMITTED,
      });
      await expect(check(['c2'])).rejects.toBeInstanceOf(BadRequestException);
    });

    it('403 for END_OF_EXAM attempts', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue({
        ...interactiveAttempt,
        feedbackMode: FeedbackMode.END_OF_EXAM,
      });
      await expect(check(['c2'])).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrismaService.examQuestion.findFirst).not.toHaveBeenCalled();
    });

    it('400 when the question is not part of the exam', async () => {
      mockPrismaService.examQuestion.findFirst.mockResolvedValue(null);
      await expect(check(['c2'], 'q-other')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockPrismaService.examQuestion.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { examId: 'exam-1', questionId: 'q-other' },
        }),
      );
    });

    it.each([
      ['empty selection', []],
      ['unknown choice id', ['c-unknown']],
      ['duplicate choice ids', ['c2', 'c2']],
    ])('400 for %s', async (_label, selected) => {
      await expect(check(selected as string[])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('409 when the question was already checked, carrying the stored result', async () => {
      const checkedAt = new Date('2026-09-25T00:00:00Z');
      tx.answer.findFirst.mockResolvedValue({
        id: 'ans-1',
        checkedAt,
        selectedChoices: ['c1'],
        isCorrect: false,
      });

      const err = await check(['c2', 'c3']).catch((e) => e);

      expect(err).toBeInstanceOf(ConflictException);
      // The stored (first) answer is returned, not the new selection.
      expect(err.getResponse()).toEqual(
        expect.objectContaining({
          message: 'Answer already checked',
          result: {
            questionId: 'q1',
            isCorrect: false,
            selectedChoiceIds: ['c1'],
            correctChoiceIds: ['c2', 'c3'],
            explanation: 'Because **B** is right.',
            checkedAt,
          },
        }),
      );
      expect(tx.answer.update).not.toHaveBeenCalled();
      expect(tx.answer.create).not.toHaveBeenCalled();
    });

    it('400 when the attempt was submitted while waiting for the row lock', async () => {
      tx.$queryRaw.mockResolvedValue([{ status: AttemptStatus.SUBMITTED }]);
      await expect(check(['c2', 'c3'])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tx.answer.create).not.toHaveBeenCalled();
    });
  });

  describe('evaluateAnswers with locked (checked) answers', () => {
    const examQuestions = [
      {
        question: {
          id: 'q1',
          choices: [
            { id: 'c1a', isCorrect: true },
            { id: 'c1b', isCorrect: false },
          ],
          domain: { name: 'A' },
        },
      },
      {
        question: {
          id: 'q2',
          choices: [
            { id: 'c2a', isCorrect: true },
            { id: 'c2b', isCorrect: false },
          ],
          domain: { name: 'A' },
        },
      },
    ];

    it('grades checked questions from the stored answer, ignoring a tampered payload', () => {
      const checkedAt = new Date('2026-09-25T00:00:00Z');
      const locked = new Map([
        ['q1', { selectedChoices: ['c1b'], isCorrect: false, checkedAt }],
      ]);
      const dto = {
        answers: [
          // Client tries to swap the revealed wrong answer for the right one.
          { questionId: 'q1', selectedChoices: ['c1a'], isMarked: true },
          { questionId: 'q2', selectedChoices: ['c2a'], isMarked: false },
        ],
      };

      const result = (service as any).evaluateAnswers(
        'att-1',
        dto,
        examQuestions,
        locked,
      );

      expect(result.totalCorrect).toBe(1);
      expect(result.answerRecords[0]).toEqual(
        expect.objectContaining({
          questionId: 'q1',
          selectedChoices: ['c1b'],
          isCorrect: false,
          isMarked: true,
          checkedAt,
        }),
      );
      expect(result.answerRecords[1]).toEqual(
        expect.objectContaining({ questionId: 'q2', isCorrect: true }),
      );
      expect(result.answerRecords[1]).not.toHaveProperty('checkedAt');
    });

    it('keeps a checked question graded even if the payload omits it', () => {
      const locked = new Map([
        [
          'q2',
          { selectedChoices: ['c2a'], isCorrect: true, checkedAt: new Date() },
        ],
      ]);
      const dto = {
        answers: [{ questionId: 'q1', selectedChoices: [], isMarked: false }],
      };

      const result = (service as any).evaluateAnswers(
        'att-1',
        dto,
        examQuestions,
        locked,
      );

      expect(result.totalCorrect).toBe(1);
      expect(
        result.answerRecords.find((r: any) => r.questionId === 'q2'),
      ).toEqual(
        expect.objectContaining({ selectedChoices: ['c2a'], isCorrect: true }),
      );
    });
  });

  describe('submit', () => {
    const attemptBase = {
      id: 'att-1',
      userId: 'user-1',
      examId: 'exam-1',
      status: AttemptStatus.IN_PROGRESS,
      startedAt: new Date(),
    };
    const tx = {
      $queryRaw: jest.fn(),
      answer: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      examAttempt: { update: jest.fn() },
      exam: { update: jest.fn() },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockPrismaService.$transaction.mockImplementation((arg: any) =>
        typeof arg === 'function' ? arg(tx) : arg,
      );
      tx.$queryRaw.mockResolvedValue([{ status: AttemptStatus.IN_PROGRESS }]);
      mockPrismaService.examQuestion.findMany.mockResolvedValue([
        {
          question: {
            id: 'q1',
            choices: [
              { id: 'c1a', isCorrect: true },
              { id: 'c1b', isCorrect: false },
            ],
            domain: { name: 'A' },
          },
        },
      ]);
      jest.spyOn(service, 'findResult').mockResolvedValue({} as any);
    });

    afterAll(() => {
      mockPrismaService.$transaction.mockImplementation((cb: any) => cb);
    });

    it('grades END_OF_EXAM attempts from the payload without reading stored answers', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue({
        ...attemptBase,
        feedbackMode: FeedbackMode.END_OF_EXAM,
      });

      await service.submit('user-1', 'att-1', {
        answers: [{ questionId: 'q1', selectedChoices: ['c1a'] }],
      });

      expect(tx.answer.findMany).not.toHaveBeenCalled();
      expect(tx.answer.deleteMany).toHaveBeenCalledWith({
        where: { attemptId: 'att-1' },
      });
      expect(tx.answer.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ questionId: 'q1', isCorrect: true })],
      });
      expect(tx.examAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AttemptStatus.SUBMITTED,
            totalCorrect: 1,
            score: 100,
          }),
        }),
      );
      expect(tx.exam.update).toHaveBeenCalledWith({
        where: { id: 'exam-1' },
        data: { attemptCount: { increment: 1 } },
      });
      expect(mockGamificationService.awardPoints).toHaveBeenCalled();
      expect(mockExamsService.updateAvgScore).toHaveBeenCalledWith('exam-1');
    });

    it('uses the checked answer for INTERACTIVE attempts', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue({
        ...attemptBase,
        feedbackMode: FeedbackMode.INTERACTIVE,
      });
      tx.answer.findMany.mockResolvedValue([
        {
          questionId: 'q1',
          selectedChoices: ['c1b'],
          isCorrect: false,
          checkedAt: new Date(),
        },
      ]);

      await service.submit('user-1', 'att-1', {
        answers: [{ questionId: 'q1', selectedChoices: ['c1a'] }],
      });

      expect(tx.answer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { attemptId: 'att-1', checkedAt: { not: null } },
        }),
      );
      expect(tx.answer.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            questionId: 'q1',
            selectedChoices: ['c1b'],
            isCorrect: false,
          }),
        ],
      });
      expect(tx.examAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totalCorrect: 0, score: 0 }),
        }),
      );
    });

    it('refuses to grade twice when the attempt was submitted while waiting for the row lock', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue({
        ...attemptBase,
        feedbackMode: FeedbackMode.END_OF_EXAM,
      });
      tx.$queryRaw.mockResolvedValue([{ status: AttemptStatus.SUBMITTED }]);

      await expect(
        service.submit('user-1', 'att-1', {
          answers: [{ questionId: 'q1', selectedChoices: ['c1a'] }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.answer.deleteMany).not.toHaveBeenCalled();
      expect(tx.exam.update).not.toHaveBeenCalled();
      expect(mockGamificationService.awardPoints).not.toHaveBeenCalled();
    });
  });
});
