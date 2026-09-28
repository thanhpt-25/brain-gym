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
import {
  DEADLINE_GRACE_MS,
  effectiveTimeLimit,
  suggestMistakeType,
} from './attempts.service';

describe('AttemptsService', () => {
  let service: AttemptsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    examAttempt: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    exam: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    question: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    reviewSchedule: {
      upsert: jest.fn(),
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
    abilityFor: jest.fn(),
    questionDifficulties: jest.fn(),
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
      mockPrismaService.examQuestion.findFirst.mockResolvedValue({
        question: {
          id: 'q1',
          choices: [
            { id: 'c1', isCorrect: true },
            { id: 'c2', isCorrect: false },
          ],
        },
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

    it('does not return isCorrect in the saved answer payload', async () => {
      mockPrismaService.answer.findFirst.mockResolvedValue(null);
      mockPrismaService.answer.count.mockResolvedValue(0);

      await service.saveAnswer(userId, attemptId, {
        questionId: 'q1',
        selectedChoices: ['c1'],
      });

      const call = mockPrismaService.answer.upsert.mock.calls[0][0];
      expect(call.select).toBeDefined();
      expect(call.select).not.toHaveProperty('isCorrect');
      // isCorrect is still persisted for grading
      expect(call.create.isCorrect).toBe(true);
    });
  });

  describe('findResult', () => {
    const ownerId = 'user-1';
    const attemptId = 'att-1';

    const attemptRecord = {
      id: attemptId,
      userId: ownerId,
      examId: 'exam-1',
      status: AttemptStatus.IN_PROGRESS,
      score: null,
      totalCorrect: null,
      totalQuestions: 1,
      domainScores: null,
      timeSpent: null,
      startedAt: new Date('2026-01-01T00:00:00Z'),
      submittedAt: null,
      exam: { title: 'Exam', certification: { id: 'cert-1' } },
      answers: [
        {
          id: 'ans-1',
          questionId: 'q1',
          isCorrect: true,
          selectedChoices: ['c1'],
          mistakeType: null,
          question: {
            title: 'Q1',
            description: null,
            explanation: 'Because',
            domain: { name: 'Domain A' },
            choices: [
              { id: 'c1', label: 'A', content: 'a', isCorrect: true },
              { id: 'c2', label: 'B', content: 'b', isCorrect: false },
            ],
          },
        },
      ],
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns the result to the attempt owner', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue(attemptRecord);

      const result = await service.findResult(attemptId, ownerId);

      expect(result.attemptId).toBe(attemptId);
      expect(result.questionResults[0].correctAnswers).toEqual(['c1']);
    });

    it('throws ForbiddenException when the requester does not own the attempt', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue(attemptRecord);

      await expect(
        service.findResult(attemptId, 'someone-else'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when the attempt does not exist', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue(null);

      await expect(
        service.findResult(attemptId, ownerId),
      ).rejects.toBeInstanceOf(NotFoundException);
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
      mockPrismaService.examQuestion.findFirst.mockResolvedValue({
        question: { id: 'q1', choices: [{ id: 'c1', isCorrect: true }] },
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
      await expect(check(selected)).rejects.toBeInstanceOf(BadRequestException);
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

  describe('Sprint 1: timer, resume and presentation order', () => {
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

    const question = (id: string, choiceIds: string[], correct: string[]) => ({
      id,
      title: `Title ${id}`,
      description: null,
      explanation: `Why ${id}`,
      questionType: correct.length > 1 ? 'MULTIPLE' : 'SINGLE',
      difficulty: 'EASY',
      isScenario: false,
      codeSnippet: 'print(1)',
      imageUrl: null,
      domain: { id: 'd1', name: 'Domain A' },
      tags: [],
      choices: choiceIds.map((cid, i) => ({
        id: cid,
        label: String.fromCharCode(97 + i),
        content: `Content ${cid}`,
        isCorrect: correct.includes(cid),
        sortOrder: i,
      })),
    });

    beforeEach(() => {
      jest.clearAllMocks();
      mockPrismaService.$transaction.mockImplementation((arg: any) =>
        typeof arg === 'function' ? arg(tx) : arg,
      );
      tx.$queryRaw.mockResolvedValue([{ status: AttemptStatus.IN_PROGRESS }]);
    });

    afterAll(() => {
      mockPrismaService.$transaction.mockImplementation((cb: any) => cb);
    });

    describe('effectiveTimeLimit', () => {
      it('scales ACCELERATED exams to 0.75x and leaves other modes alone', () => {
        expect(
          effectiveTimeLimit({
            timeLimit: 180,
            timerMode: 'ACCELERATED' as any,
          }),
        ).toBe(135);
        expect(
          effectiveTimeLimit({ timeLimit: 180, timerMode: 'STRICT' as any }),
        ).toBe(180);
        expect(
          effectiveTimeLimit({ timeLimit: 1, timerMode: 'ACCELERATED' as any }),
        ).toBe(1);
      });
    });

    describe('start', () => {
      const exam = (timerMode: string) => ({
        id: 'exam-1',
        title: 'Exam',
        certification: { id: 'cert-1' },
        timeLimit: 100,
        timerMode,
        deletedAt: null,
        examQuestions: [
          { question: question('q1', ['c1', 'c2', 'c3'], ['c1', 'c3']) },
          { question: question('q2', ['d1', 'd2'], ['d2']) },
        ],
      });

      beforeEach(() => {
        mockPrismaService.examAttempt.create.mockImplementation(({ data }) =>
          Promise.resolve({ id: 'att-1', ...data }),
        );
      });

      it('stores a server deadline from the effective (accelerated) time limit', async () => {
        mockPrismaService.exam.findUnique.mockResolvedValue(
          exam('ACCELERATED'),
        );
        const before = Date.now();

        const res = await service.start('user-1', 'exam-1');

        const data = mockPrismaService.examAttempt.create.mock.calls[0][0].data;
        expect(res.timeLimit).toBe(75);
        const ms = data.expiresAt.getTime() - data.startedAt.getTime();
        expect(ms).toBe(75 * 60_000);
        expect(data.startedAt.getTime()).toBeGreaterThanOrEqual(before);
        expect(res.expiresAt).toEqual(data.expiresAt);
        expect(res.serverNow).toBeInstanceOf(Date);
      });

      it('stores the presented question and choice order and returns it', async () => {
        mockPrismaService.exam.findUnique.mockResolvedValue(exam('STRICT'));

        const res = await service.start('user-1', 'exam-1');

        const { presentation } =
          mockPrismaService.examAttempt.create.mock.calls[0][0].data;
        expect(presentation.questionIds).toEqual(
          res.questions.map((q) => q.id),
        );
        for (const q of res.questions) {
          expect(presentation.choiceIds[q.id]).toEqual(
            q.choices.map((c) => c.id),
          );
        }
      });

      it('returns scenario/code/image fields and "choose N" for multi-select, never the answer', async () => {
        mockPrismaService.exam.findUnique.mockResolvedValue(exam('STRICT'));

        const res = await service.start('user-1', 'exam-1');
        const q1 = res.questions.find((q) => q.id === 'q1') as any;
        const q2 = res.questions.find((q) => q.id === 'q2') as any;

        expect(q1).toMatchObject({
          codeSnippet: 'print(1)',
          isScenario: false,
          selectCount: 2,
        });
        expect(q2).not.toHaveProperty('selectCount');
        expect(q1).not.toHaveProperty('explanation');
        expect(q1.choices[0]).not.toHaveProperty('isCorrect');
      });
    });

    describe('deadline enforcement', () => {
      const expired = {
        id: 'att-1',
        userId: 'user-1',
        examId: 'exam-1',
        status: AttemptStatus.IN_PROGRESS,
        feedbackMode: FeedbackMode.END_OF_EXAM,
        startedAt: new Date(Date.now() - 3_600_000),
        expiresAt: new Date(Date.now() - DEADLINE_GRACE_MS - 1_000),
        exam: { timeLimit: 30, timerMode: 'STRICT' },
      };

      it('rejects autosaves after the deadline', async () => {
        mockPrismaService.examAttempt.findUnique.mockResolvedValue(expired);
        await expect(
          service.saveAnswer('user-1', 'att-1', {
            questionId: 'q1',
            selectedChoices: [],
          }),
        ).rejects.toThrow('Time is up');
        expect(mockPrismaService.answer.upsert).not.toHaveBeenCalled();
      });

      it('still accepts an autosave within the grace period', async () => {
        mockPrismaService.examAttempt.findUnique.mockResolvedValue({
          ...expired,
          expiresAt: new Date(Date.now() - DEADLINE_GRACE_MS / 2),
        });
        mockPrismaService.examQuestion.findFirst.mockResolvedValue({
          question: question('q1', ['c1'], ['c1']),
        });
        mockPrismaService.answer.findFirst.mockResolvedValue(null);
        mockPrismaService.answer.count.mockResolvedValue(0);

        await service.saveAnswer('user-1', 'att-1', {
          questionId: 'q1',
          selectedChoices: ['c1'],
        });
        expect(mockPrismaService.answer.upsert).toHaveBeenCalled();
      });

      it('rejects interactive checks after the deadline', async () => {
        mockPrismaService.examAttempt.findUnique.mockResolvedValue({
          ...expired,
          feedbackMode: FeedbackMode.INTERACTIVE,
        });
        await expect(
          service.checkAnswer('user-1', 'att-1', {
            questionId: 'q1',
            selectedChoices: ['c1'],
          }),
        ).rejects.toThrow('Time is up');
      });

      it('grades a late submit from autosaved answers, ignoring the payload', async () => {
        mockPrismaService.examAttempt.findUnique
          .mockResolvedValueOnce(expired) // submit()
          .mockResolvedValueOnce({
            ...expired,
            presentation: {
              questionIds: ['q1'],
              choiceIds: { q1: ['c1', 'c2'] },
            },
            exam: {
              ...expired.exam,
              examQuestions: [
                { question: question('q1', ['c1', 'c2'], ['c1']) },
              ],
            },
          }); // closeFromStoredAnswers()
        tx.answer.findMany.mockResolvedValue([
          { questionId: 'q1', selectedChoices: ['c2'], isCorrect: false },
        ]);
        jest.spyOn(service, 'findResult').mockResolvedValue({} as any);

        await service.submit('user-1', 'att-1', {
          answers: [{ questionId: 'q1', selectedChoices: ['c1'] }],
        });

        expect(tx.answer.deleteMany).not.toHaveBeenCalled();
        expect(tx.examAttempt.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: AttemptStatus.SUBMITTED,
              totalCorrect: 0,
              // capped at the 30 minute limit, not the hour that passed
              timeSpent: expect.any(Number),
            }),
          }),
        );
        const { timeSpent } = tx.examAttempt.update.mock.calls[0][0].data;
        expect(timeSpent).toBeLessThanOrEqual(3_600 - DEADLINE_GRACE_MS / 1000);
      });
    });

    describe('closeExpiredAttempts', () => {
      it('abandons an expired attempt with no answers instead of scoring it 0%', async () => {
        const attempt = {
          id: 'att-1',
          userId: 'user-1',
          examId: 'exam-1',
          startedAt: new Date(Date.now() - 7_200_000),
          expiresAt: new Date(Date.now() - 3_600_000),
          presentation: null,
          exam: {
            timeLimit: 60,
            timerMode: 'STRICT',
            examQuestions: [{ question: question('q1', ['c1'], ['c1']) }],
          },
        };
        mockPrismaService.examAttempt.findMany.mockResolvedValue([attempt]);
        mockPrismaService.examAttempt.findUnique.mockResolvedValue(attempt);
        tx.answer.findMany.mockResolvedValue([]);

        await service.closeExpiredAttempts('user-1');

        expect(tx.examAttempt.update).toHaveBeenCalledWith({
          where: { id: 'att-1' },
          data: expect.objectContaining({ status: AttemptStatus.ABANDONED }),
        });
        expect(tx.exam.update).not.toHaveBeenCalled();
        expect(mockGamificationService.awardPoints).not.toHaveBeenCalled();
      });

      it('grades an expired attempt with answers and records skipped questions', async () => {
        const attempt = {
          id: 'att-1',
          userId: 'user-1',
          examId: 'exam-1',
          startedAt: new Date(Date.now() - 7_200_000),
          expiresAt: new Date(Date.now() - 3_600_000),
          presentation: { questionIds: ['q2', 'q1'], choiceIds: {} },
          exam: {
            timeLimit: 60,
            timerMode: 'STRICT',
            examQuestions: [
              { question: question('q1', ['c1'], ['c1']) },
              { question: question('q2', ['d1'], ['d1']) },
            ],
          },
        };
        mockPrismaService.examAttempt.findMany.mockResolvedValue([attempt]);
        mockPrismaService.examAttempt.findUnique.mockResolvedValue(attempt);
        tx.answer.findMany.mockResolvedValue([
          { questionId: 'q2', selectedChoices: ['d1'], isCorrect: true },
        ]);

        await service.closeExpiredAttempts('user-1');

        expect(tx.answer.createMany).toHaveBeenCalledWith({
          data: [
            expect.objectContaining({
              questionId: 'q1',
              selectedChoices: [],
              questionOrder: 1,
            }),
          ],
        });
        expect(tx.examAttempt.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: AttemptStatus.SUBMITTED,
              totalCorrect: 1,
              score: 50,
              timeSpent: 3_600,
            }),
          }),
        );
        expect(mockGamificationService.awardPoints).toHaveBeenCalled();
      });

      it('leaves attempts that are still running alone', async () => {
        mockPrismaService.examAttempt.findMany.mockResolvedValue([
          {
            id: 'att-1',
            startedAt: new Date(),
            expiresAt: new Date(Date.now() + 60_000),
            exam: { timeLimit: 60 },
          },
        ]);
        await service.closeExpiredAttempts('user-1');
        expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      });
    });

    describe('saveAnswer ordering and validation', () => {
      beforeEach(() => {
        mockPrismaService.examAttempt.findUnique.mockResolvedValue({
          id: 'att-1',
          userId: 'user-1',
          status: AttemptStatus.IN_PROGRESS,
          presentation: { questionIds: ['q2', 'q1'], choiceIds: {} },
        });
        mockPrismaService.examQuestion.findFirst.mockResolvedValue({
          question: question('q1', ['c1', 'c2'], ['c1']),
        });
        mockPrismaService.answer.findFirst.mockResolvedValue(null);
      });

      it('uses the presented position as questionOrder', async () => {
        await service.saveAnswer('user-1', 'att-1', {
          questionId: 'q1',
          selectedChoices: ['c1'],
        });
        expect(mockPrismaService.answer.count).not.toHaveBeenCalled();
        expect(
          mockPrismaService.answer.upsert.mock.calls[0][0].create.questionOrder,
        ).toBe(1);
      });

      it('rejects questions that are not part of the exam', async () => {
        mockPrismaService.examQuestion.findFirst.mockResolvedValue(null);
        await expect(
          service.saveAnswer('user-1', 'att-1', {
            questionId: 'qx',
            selectedChoices: [],
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('rejects choices that do not belong to the question', async () => {
        await expect(
          service.saveAnswer('user-1', 'att-1', {
            questionId: 'q1',
            selectedChoices: ['zz'],
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('saves a flag with no selection', async () => {
        await service.saveAnswer('user-1', 'att-1', {
          questionId: 'q1',
          selectedChoices: [],
          isMarked: true,
        });
        expect(
          mockPrismaService.answer.upsert.mock.calls[0][0].create,
        ).toMatchObject({
          selectedChoices: [],
          isMarked: true,
          isCorrect: false,
        });
      });
    });

    describe('getState', () => {
      const attempt = {
        id: 'att-1',
        userId: 'user-1',
        examId: 'exam-1',
        status: AttemptStatus.IN_PROGRESS,
        feedbackMode: FeedbackMode.INTERACTIVE,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 600_000),
        presentation: {
          questionIds: ['q2', 'q1'],
          choiceIds: { q1: ['c2', 'c1'], q2: ['d1', 'd2'] },
        },
        exam: {
          title: 'Exam',
          timeLimit: 40,
          timerMode: 'ACCELERATED',
          certification: { id: 'cert-1' },
          examQuestions: [
            { question: question('q1', ['c1', 'c2'], ['c1']) },
            { question: question('q2', ['d1', 'd2'], ['d2']) },
          ],
        },
        answers: [
          {
            questionId: 'q1',
            selectedChoices: ['c2'],
            isMarked: true,
            isCorrect: false,
            checkedAt: new Date(),
          },
        ],
      };

      it('restores the presented order, labels, saved answers and revealed verdicts', async () => {
        mockPrismaService.examAttempt.findUnique.mockResolvedValue(attempt);

        const state = await service.getState('user-1', 'att-1');

        expect(state.status).toBe(AttemptStatus.IN_PROGRESS);
        expect(state.timeLimit).toBe(30);
        expect(state.expiresAt).toEqual(attempt.expiresAt);
        expect(state.questions!.map((q) => q.id)).toEqual(['q2', 'q1']);
        expect(state.questions![1].choices).toEqual([
          { id: 'c2', label: 'a', content: 'Content c2' },
          { id: 'c1', label: 'b', content: 'Content c1' },
        ]);
        expect(state.answers).toEqual([
          {
            questionId: 'q1',
            selectedChoices: ['c2'],
            isMarked: true,
            timeSpent: 0,
          },
        ]);
        expect(state.checked).toEqual([
          expect.objectContaining({
            questionId: 'q1',
            isCorrect: false,
            correctChoiceIds: ['c1'],
            explanation: 'Why q1',
          }),
        ]);
      });

      it('only reports the status of an attempt that is no longer in progress', async () => {
        mockPrismaService.examAttempt.findUnique.mockResolvedValue({
          ...attempt,
          status: AttemptStatus.SUBMITTED,
        });
        expect(await service.getState('user-1', 'att-1')).toEqual({
          attemptId: 'att-1',
          status: AttemptStatus.SUBMITTED,
        });
      });

      it("403 on another user's attempt", async () => {
        mockPrismaService.examAttempt.findUnique.mockResolvedValue(attempt);
        await expect(
          service.getState('user-2', 'att-1'),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });

    describe('findActive', () => {
      it('returns the latest resumable attempt for the certification', async () => {
        mockPrismaService.examAttempt.findMany.mockResolvedValue([]);
        const expiresAt = new Date(Date.now() + 60_000);
        mockPrismaService.examAttempt.findFirst.mockResolvedValue({
          id: 'att-1',
          examId: 'exam-1',
          feedbackMode: FeedbackMode.END_OF_EXAM,
          totalQuestions: 10,
          startedAt: new Date(),
          expiresAt,
          exam: {
            title: 'Exam',
            timeLimit: 60,
            timerMode: 'STRICT',
            certificationId: 'cert-1',
          },
          _count: { answers: 3 },
        });

        const { active } = await service.findActive('user-1', 'cert-1');

        expect(mockPrismaService.examAttempt.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              userId: 'user-1',
              status: AttemptStatus.IN_PROGRESS,
              exam: { deletedAt: null, certificationId: 'cert-1' },
            }),
          }),
        );
        expect(active).toMatchObject({
          attemptId: 'att-1',
          answeredCount: 3,
          totalQuestions: 10,
          expiresAt,
        });
      });

      it('returns null when nothing is in progress', async () => {
        mockPrismaService.examAttempt.findMany.mockResolvedValue([]);
        mockPrismaService.examAttempt.findFirst.mockResolvedValue(null);
        expect(await service.findActive('user-1')).toEqual({ active: null });
      });
    });

    describe('abandon', () => {
      it('marks an in-progress attempt ABANDONED', async () => {
        mockPrismaService.examAttempt.findUnique.mockResolvedValue({
          userId: 'user-1',
          status: AttemptStatus.IN_PROGRESS,
        });
        mockPrismaService.examAttempt.updateMany.mockResolvedValue({
          count: 1,
        });

        await expect(service.abandon('user-1', 'att-1')).resolves.toEqual({
          attemptId: 'att-1',
          status: AttemptStatus.ABANDONED,
        });
      });

      it('refuses to abandon a submitted attempt', async () => {
        mockPrismaService.examAttempt.findUnique.mockResolvedValue({
          userId: 'user-1',
          status: AttemptStatus.SUBMITTED,
        });
        await expect(service.abandon('user-1', 'att-1')).rejects.toBeInstanceOf(
          BadRequestException,
        );
      });
    });

    describe('findResult', () => {
      it('shows choices in the presented order with the letters the learner saw, and the pass mark', async () => {
        mockPrismaService.examAttempt.findUnique.mockResolvedValue({
          id: 'att-1',
          userId: 'user-1',
          examId: 'exam-1',
          status: AttemptStatus.SUBMITTED,
          score: 80,
          totalCorrect: 4,
          totalQuestions: 5,
          startedAt: new Date(),
          presentation: {
            questionIds: ['q1'],
            choiceIds: { q1: ['c3', 'c1', 'c2'] },
          },
          exam: {
            title: 'Exam',
            certification: { id: 'cert-1', passingScore: 85 },
          },
          answers: [
            {
              id: 'ans-1',
              questionId: 'q1',
              isCorrect: true,
              selectedChoices: ['c1'],
              question: question('q1', ['c1', 'c2', 'c3'], ['c1']),
            },
          ],
        });

        const res = await service.findResult('att-1', 'user-1');

        expect(
          res.questionResults[0].choices.map((c) => [c.id, c.label]),
        ).toEqual([
          ['c3', 'a'],
          ['c1', 'b'],
          ['c2', 'c'],
        ]);
        expect(res.questionResults[0].codeSnippet).toBe('print(1)');
        expect(res.passingScore).toBe(85);
        expect(res.passed).toBe(false);
      });
    });
  });

  describe('Sprint 2: per-question time and practice exams', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('suggestMistakeType', () => {
      it('suggests CARELESS for a wrong answer given in a few seconds', () => {
        expect(suggestMistakeType(false, true, 4, 80)).toBe('CARELESS');
      });

      it('suggests TIME_PRESSURE for a wrong answer far over the target pace', () => {
        expect(suggestMistakeType(false, true, 200, 80)).toBe('TIME_PRESSURE');
      });

      it('suggests nothing for correct, skipped, untimed or normally paced answers', () => {
        expect(suggestMistakeType(true, true, 2, 80)).toBeUndefined();
        expect(suggestMistakeType(false, false, 2, 80)).toBeUndefined();
        expect(suggestMistakeType(false, true, null, 80)).toBeUndefined();
        expect(suggestMistakeType(false, true, 60, 80)).toBeUndefined();
        expect(suggestMistakeType(false, true, 500, null)).toBeUndefined();
      });
    });

    describe('saveAnswer timeSpent', () => {
      beforeEach(() => {
        mockPrismaService.examAttempt.findUnique.mockResolvedValue({
          id: 'att-1',
          userId: 'user-1',
          status: AttemptStatus.IN_PROGRESS,
          startedAt: new Date(Date.now() - 120_000),
          expiresAt: new Date(Date.now() + 600_000),
        });
        mockPrismaService.examQuestion.findFirst.mockResolvedValue({
          question: { id: 'q1', choices: [{ id: 'c1', isCorrect: true }] },
        });
        mockPrismaService.answer.findFirst.mockResolvedValue(null);
        mockPrismaService.answer.count.mockResolvedValue(0);
      });

      it('stores the time spent on the question', async () => {
        await service.saveAnswer('user-1', 'att-1', {
          questionId: 'q1',
          selectedChoices: ['c1'],
          timeSpent: 42,
        });
        const call = mockPrismaService.answer.upsert.mock.calls[0][0];
        expect(call.create.timeSpent).toBe(42);
        expect(call.update.timeSpent).toBe(42);
      });

      it('caps it at how long the attempt has been running', async () => {
        await service.saveAnswer('user-1', 'att-1', {
          questionId: 'q1',
          selectedChoices: ['c1'],
          timeSpent: 5_000,
        });
        const { create } = mockPrismaService.answer.upsert.mock.calls[0][0];
        expect(create.timeSpent).toBeGreaterThanOrEqual(119);
        expect(create.timeSpent).toBeLessThanOrEqual(121);
      });

      it('leaves the stored time alone when none is sent', async () => {
        await service.saveAnswer('user-1', 'att-1', {
          questionId: 'q1',
          selectedChoices: ['c1'],
        });
        const call = mockPrismaService.answer.upsert.mock.calls[0][0];
        expect(call.create).not.toHaveProperty('timeSpent');
        expect(call.update).not.toHaveProperty('timeSpent');
      });
    });

    it('records submitted per-question times with the graded answers', () => {
      const { answerRecords } = (service as any).evaluateAnswers(
        'att-1',
        {
          answers: [
            { questionId: 'q1', selectedChoices: ['c1'], timeSpent: 30 },
          ],
        },
        [
          {
            question: {
              id: 'q1',
              choices: [{ id: 'c1', isCorrect: true }],
              domain: null,
            },
          },
          {
            question: {
              id: 'q2',
              choices: [{ id: 'c2', isCorrect: true }],
              domain: null,
            },
          },
        ],
      );
      expect(answerRecords.map((r: any) => r.timeSpent)).toEqual([30, null]);
    });

    it('returns per-question time, the target pace and mistake hints', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue({
        id: 'att-1',
        userId: 'user-1',
        examId: 'exam-1',
        status: AttemptStatus.SUBMITTED,
        score: 0,
        totalQuestions: 2,
        startedAt: new Date(),
        exam: {
          title: 'Exam',
          timeLimit: 4,
          timerMode: 'STRICT',
          certification: { id: 'cert-1' },
        },
        answers: [
          {
            id: 'a1',
            questionId: 'q1',
            isCorrect: false,
            selectedChoices: ['c2'],
            timeSpent: 3,
            question: {
              title: 'Q1',
              domain: null,
              choices: [
                { id: 'c1', label: 'a', content: 'x', isCorrect: true },
                { id: 'c2', label: 'b', content: 'y', isCorrect: false },
              ],
            },
          },
          {
            id: 'a2',
            questionId: 'q2',
            isCorrect: false,
            selectedChoices: ['c2'],
            timeSpent: 400,
            question: {
              title: 'Q2',
              domain: null,
              choices: [
                { id: 'c1', label: 'a', content: 'x', isCorrect: true },
                { id: 'c2', label: 'b', content: 'y', isCorrect: false },
              ],
            },
          },
        ],
      });

      const res = await service.findResult('att-1', 'user-1');

      expect(res.targetSecondsPerQuestion).toBe(120);
      expect(
        res.questionResults.map((r) => [r.timeSpent, r.suggestedMistakeType]),
      ).toEqual([
        [3, 'CARELESS'],
        [400, 'TIME_PRESSURE'],
      ]);
    });

    it("refuses to start someone else's practice exam", async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        isPractice: true,
        createdBy: 'user-2',
        deletedAt: null,
        timeLimit: 10,
        timerMode: 'STRICT',
        certification: { id: 'cert-1' },
        examQuestions: [],
      });
      await expect(service.start('user-1', 'exam-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('Sprint 3: modes, insights and review queue', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const mockExam = {
      id: 'exam-1',
      title: 'Mock',
      practiceMode: 'FULL_MOCK',
      isPractice: true,
      createdBy: 'user-1',
      deletedAt: null,
      timeLimit: 30,
      timerMode: 'STRICT',
      certification: { id: 'cert-1' },
      examQuestions: [
        {
          question: {
            id: 'q1',
            title: 'Q1',
            description: null,
            questionType: 'SINGLE',
            difficulty: 'HARD',
            domain: { id: 'd1', name: 'Networking' },
            tags: [{ tag: { name: 'vpc' } }],
            choices: [{ id: 'c1', content: 'A', isCorrect: true }],
          },
        },
      ],
    };

    it('a full mock hides difficulty, domain and tags, like the real exam', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(mockExam);
      mockPrismaService.examAttempt.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'att-1', ...data }),
      );

      const res = await service.start('user-1', 'exam-1');

      expect(res.practiceMode).toBe('FULL_MOCK');
      expect(res.questions[0]).toMatchObject({
        difficulty: null,
        domain: null,
        tags: [],
      });
    });

    it('a full mock cannot be taken in Interactive mode', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(mockExam);
      await expect(
        service.start('user-1', 'exam-1', FeedbackMode.INTERACTIVE),
      ).rejects.toThrow('full mock');
    });

    describe('insights', () => {
      const attempt = {
        id: 'att-1',
        userId: 'user-1',
        status: AttemptStatus.SUBMITTED,
        exam: {
          certificationId: 'cert-1',
          certification: { passingScore: 72 },
        },
        answers: [
          {
            isCorrect: true,
            isMarked: false,
            selectedChoices: ['x'],
            question: { domain: { id: 'd1', name: 'Networking' } },
          },
          {
            isCorrect: false,
            isMarked: true,
            selectedChoices: ['y'],
            question: { domain: { id: 'd2', name: 'Security' } },
          },
          {
            isCorrect: false,
            isMarked: false,
            selectedChoices: [],
            question: { domain: { id: 'd2', name: 'Security' } },
          },
        ],
      };

      beforeEach(() => {
        mockPrismaService.examAttempt.findUnique.mockResolvedValue(attempt);
        mockPrismaService.examAttempt.findMany.mockResolvedValue([
          {
            id: 'att-1',
            submittedAt: new Date(2),
            score: 33.3,
            domainScores: {},
          },
          {
            id: 'att-0',
            submittedAt: new Date(1),
            score: 50,
            domainScores: {},
          },
        ]);
        mockPrismaService.question.findMany.mockResolvedValue(
          Array.from({ length: 100 }, (_, i) => ({
            id: `q${i}`,
            difficulty: 'MEDIUM',
          })),
        );
        mockExamsService.questionDifficulties.mockResolvedValue(
          new Map(Array.from({ length: 100 }, (_, i) => [`q${i}`, 0])),
        );
      });

      it('summarises missed work, the weakest domain and the trend', async () => {
        mockExamsService.abilityFor.mockResolvedValue({
          theta: 1.5,
          se: 0.3,
          answered: 40,
        });

        const res = await service.insights('user-1', 'att-1');

        expect(res).toMatchObject({
          missedCount: 2,
          skippedCount: 1,
          flaggedCount: 1,
          weakestDomain: { domainId: 'd2', name: 'Security', percentage: 0 },
        });
        // Oldest first for charting.
        expect(res.trend.map((t) => t.attemptId)).toEqual(['att-0', 'att-1']);
        expect(res.trend[1].score).toBe(33);
        expect(res.readiness).toMatchObject({
          passingScore: 72,
          examLength: 65,
          basedOnQuestions: 40,
        });
        expect(res.readiness.passLikelihood).toBeGreaterThan(50);
      });

      it('gives no pass likelihood without any history', async () => {
        mockExamsService.abilityFor.mockResolvedValue({
          theta: 0,
          se: 1,
          answered: 0,
        });
        const res = await service.insights('user-1', 'att-1');
        expect(res.readiness.passLikelihood).toBeNull();
      });

      it("refuses another user's or an unsubmitted attempt", async () => {
        await expect(
          service.insights('user-2', 'att-1'),
        ).rejects.toBeInstanceOf(ForbiddenException);
        mockPrismaService.examAttempt.findUnique.mockResolvedValue({
          ...attempt,
          status: AttemptStatus.IN_PROGRESS,
        });
        await expect(
          service.insights('user-1', 'att-1'),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    describe('addMissedToReview', () => {
      it('queues wrong and skipped questions for review now', async () => {
        mockPrismaService.examAttempt.findUnique.mockResolvedValue({
          userId: 'user-1',
          status: AttemptStatus.SUBMITTED,
          answers: [
            { questionId: 'q1', isCorrect: true },
            { questionId: 'q2', isCorrect: false },
            { questionId: 'q3', isCorrect: null },
          ],
        });
        mockPrismaService.$transaction.mockImplementation((arg: any) =>
          Array.isArray(arg) ? Promise.all(arg) : arg,
        );

        const res = await service.addMissedToReview('user-1', 'att-1');

        expect(res).toEqual({ added: 2 });
        const calls = mockPrismaService.reviewSchedule.upsert.mock.calls.map(
          (c) => c[0],
        );
        expect(calls.map((c) => c.where.userId_questionId.questionId)).toEqual([
          'q2',
          'q3',
        ]);
        expect(calls[0].update).toMatchObject({
          intervalDays: 0,
          repetitions: 0,
          lapses: { increment: 1 },
        });
        mockPrismaService.$transaction.mockImplementation((cb: any) => cb);
      });

      it("refuses another user's attempt", async () => {
        mockPrismaService.examAttempt.findUnique.mockResolvedValue({
          userId: 'user-2',
          status: AttemptStatus.SUBMITTED,
          answers: [],
        });
        await expect(
          service.addMissedToReview('user-1', 'att-1'),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });
  });

  describe('CAT: computerized adaptive test', () => {
    const q = (id: string, domainId = 'd1') => ({
      id,
      title: `Title ${id}`,
      description: null,
      explanation: null,
      questionType: 'SINGLE',
      difficulty: 'MEDIUM',
      isScenario: false,
      codeSnippet: null,
      imageUrl: null,
      domainId,
      domain: { id: domainId, name: domainId },
      tags: [{ tag: { name: 't' } }],
      choices: [
        { id: `${id}-ok`, content: 'right', isCorrect: true, sortOrder: 0 },
        { id: `${id}-no`, content: 'wrong', isCorrect: false, sortOrder: 1 },
      ],
    });
    const catExam = {
      id: 'exam-1',
      title: 'CAT',
      practiceMode: 'CAT',
      isPractice: true,
      createdBy: 'user-1',
      deletedAt: null,
      certificationId: 'cert-1',
      questionCount: 2,
      timeLimit: 10,
      timerMode: 'STRICT',
      certification: { id: 'cert-1', domains: [] },
      examQuestions: [q('q1'), q('q2'), q('q3')].map((question) => ({
        question,
      })),
    };
    const tx = {
      $queryRaw: jest.fn(),
      examAttempt: { findUnique: jest.fn(), update: jest.fn() },
      answer: { create: jest.fn(), findMany: jest.fn() },
      question: { findUniqueOrThrow: jest.fn() },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockPrismaService.$transaction.mockImplementation((arg: any) =>
        typeof arg === 'function' ? arg(tx) : arg,
      );
      tx.$queryRaw.mockResolvedValue([{ status: AttemptStatus.IN_PROGRESS }]);
      mockExamsService.questionDifficulties.mockResolvedValue(
        new Map([
          ['q1', -1],
          ['q2', 0],
          ['q3', 1],
        ]),
      );
      mockExamsService.abilityFor.mockResolvedValue({
        theta: 0.1,
        se: 0.8,
        answered: 5,
      });
      mockPrismaService.examAttempt.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'att-1', ...data }),
      );
    });

    afterAll(() => {
      mockPrismaService.$transaction.mockImplementation((cb: any) => cb);
    });

    it('starts with a single question picked at the prior ability', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(catExam);
      // Randomesque picks among the top 3; take the best one.
      const random = jest.spyOn(Math, 'random').mockReturnValue(0);

      const res: any = await service.start('user-1', 'exam-1');
      random.mockRestore();

      expect(res.questions).toHaveLength(1);
      // Most informative at theta 0.1: b = 0.
      expect(res.questions[0]).toMatchObject({
        id: 'q2',
        difficulty: null,
        domain: null,
      });
      expect(res.cat).toMatchObject({ answered: 0, maxItems: 2, done: false });
      const { data } = mockPrismaService.examAttempt.create.mock.calls[0][0];
      expect(data.totalQuestions).toBe(2);
      expect(data.presentation.questionIds).toEqual(['q2']);
      expect(data.presentation.cat).toMatchObject({
        priorTheta: 0.1,
        theta: 0.1,
        maxItems: 2,
        minItems: 2,
      });
      expect(data.presentation.cat.pool).toHaveLength(3);
    });

    it('refuses Interactive mode', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(catExam);
      await expect(
        service.start('user-1', 'exam-1', FeedbackMode.INTERACTIVE),
      ).rejects.toThrow('adaptive');
    });

    const presentation = (questionIds: string[], done = false) => ({
      questionIds,
      choiceIds: {},
      cat: {
        maxItems: 2,
        minItems: 2,
        targetSe: 0.3,
        pool: [
          { id: 'q1', b: -1, domainId: 'd1' },
          { id: 'q2', b: 0, domainId: 'd1' },
          { id: 'q3', b: 1, domainId: 'd1' },
        ],
        priorTheta: 0,
        domainShares: { d1: 1 },
        theta: 0,
        se: 1,
        done,
      },
    });
    const inProgress = (questionIds: string[]) => ({
      id: 'att-1',
      userId: 'user-1',
      examId: 'exam-1',
      status: AttemptStatus.IN_PROGRESS,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 600_000),
      presentation: presentation(questionIds),
      exam: { timeLimit: 10, timerMode: 'STRICT' },
    });

    beforeEach(() => {
      mockPrismaService.examQuestion.findFirst.mockImplementation(
        ({ where }: any) => Promise.resolve({ question: q(where.questionId) }),
      );
    });

    it('only accepts the current question', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue(
        inProgress(['q2']),
      );
      await expect(
        service.answerCat('user-1', 'att-1', {
          questionId: 'q1',
          selectedChoices: ['q1-ok'],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('grades the answer, raises the estimate and gives a harder question', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue(
        inProgress(['q2']),
      );
      tx.examAttempt.findUnique.mockResolvedValue({
        presentation: presentation(['q2']),
      });
      tx.answer.findMany.mockResolvedValue([
        { questionId: 'q2', isCorrect: true },
      ]);
      tx.question.findUniqueOrThrow.mockImplementation(({ where }: any) =>
        Promise.resolve(q(where.id)),
      );

      // Randomesque picks among the top 3; take the most informative one.
      const random = jest.spyOn(Math, 'random').mockReturnValue(0);
      const res = await service.answerCat('user-1', 'att-1', {
        questionId: 'q2',
        selectedChoices: ['q2-ok'],
        timeSpent: 20,
      });
      random.mockRestore();

      expect(tx.answer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          questionId: 'q2',
          isCorrect: true,
          questionOrder: 0,
        }),
      });
      expect(res.done).toBe(false);
      expect(res.question).toMatchObject({ id: 'q3', difficulty: null });
      expect(res.progress).toMatchObject({ answered: 1, done: false });
      const saved = tx.examAttempt.update.mock.calls[0][0].data.presentation;
      expect(saved.questionIds).toEqual(['q2', 'q3']);
      expect(saved.choiceIds.q3).toHaveLength(2);
      expect(saved.cat.theta).toBeGreaterThan(0);
      expect(saved.cat.se).toBeLessThan(1);
    });

    it('ends and grades the test when it reaches its length', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue(
        inProgress(['q2', 'q3']),
      );
      tx.examAttempt.findUnique.mockResolvedValue({
        presentation: presentation(['q2', 'q3']),
      });
      tx.answer.findMany.mockResolvedValue([
        { questionId: 'q2', isCorrect: true },
        { questionId: 'q3', isCorrect: false },
      ]);
      const close = jest
        .spyOn(service as any, 'closeFromStoredAnswers')
        .mockResolvedValue(AttemptStatus.SUBMITTED);
      jest.spyOn(service, 'findResult').mockResolvedValue({ id: 'r' } as any);

      const res = await service.answerCat('user-1', 'att-1', {
        questionId: 'q3',
        selectedChoices: ['q3-no'],
      });

      expect(res).toMatchObject({
        done: true,
        progress: { answered: 2, done: true, stoppedBy: 'MAX_ITEMS' },
        result: { id: 'r' },
      });
      expect(close).toHaveBeenCalledWith('att-1');
    });

    it('rejects empty or foreign choices', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue(
        inProgress(['q2']),
      );
      await expect(
        service.answerCat('user-1', 'att-1', {
          questionId: 'q2',
          selectedChoices: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.answerCat('user-1', 'att-1', {
          questionId: 'q2',
          selectedChoices: ['q1-ok'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not take autosaves; submit ends the test early', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue(
        inProgress(['q2']),
      );
      await expect(
        service.saveAnswer('user-1', 'att-1', {
          questionId: 'q2',
          selectedChoices: ['q2-ok'],
        }),
      ).rejects.toThrow('cat/answer');

      const close = jest
        .spyOn(service as any, 'closeFromStoredAnswers')
        .mockResolvedValue(AttemptStatus.SUBMITTED);
      jest.spyOn(service, 'findResult').mockResolvedValue({} as any);
      await service.submit('user-1', 'att-1', { answers: [] });
      expect(close).toHaveBeenCalledWith('att-1', { expired: false });
      expect(mockPrismaService.examQuestion.findMany).not.toHaveBeenCalled();
    });

    it('scores only the questions the test gave and got answers to', async () => {
      const attempt = {
        ...inProgress(['q2', 'q3']),
        exam: {
          timeLimit: 10,
          timerMode: 'STRICT',
          examQuestions: catExam.examQuestions,
        },
      };
      mockPrismaService.examAttempt.findUnique.mockResolvedValue(attempt);
      const closeTx = {
        $queryRaw: jest
          .fn()
          .mockResolvedValue([{ status: AttemptStatus.IN_PROGRESS }]),
        answer: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ questionId: 'q2', isCorrect: true }]),
          createMany: jest.fn(),
        },
        examAttempt: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ presentation: presentation(['q2', 'q3']) }),
          update: jest.fn(),
        },
        exam: { update: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation((cb: any) =>
        cb(closeTx),
      );

      await (service as any).closeFromStoredAnswers('att-1');

      expect(closeTx.answer.createMany).not.toHaveBeenCalled();
      const { data } = closeTx.examAttempt.update.mock.calls[0][0];
      expect(data).toMatchObject({
        status: AttemptStatus.SUBMITTED,
        totalQuestions: 1,
        totalCorrect: 1,
        score: 100,
      });
      expect(data.presentation.cat).toMatchObject({
        done: true,
        stoppedBy: 'ENDED_EARLY',
      });
    });

    it('reports the measured ability and judges passing by it', async () => {
      mockPrismaService.examAttempt.findUnique.mockResolvedValue({
        id: 'att-1',
        userId: 'user-1',
        examId: 'exam-1',
        status: AttemptStatus.SUBMITTED,
        score: 50,
        totalQuestions: 2,
        startedAt: new Date(),
        presentation: {
          ...presentation(['q2', 'q3'], true),
          cat: {
            ...presentation(['q2', 'q3'], true).cat,
            theta: 2.5,
            se: 0.3,
            stoppedBy: 'PRECISION',
          },
        },
        exam: {
          title: 'CAT',
          timeLimit: 10,
          timerMode: 'STRICT',
          certification: { id: 'cert-1', passingScore: 70 },
        },
        answers: [],
      });

      const res = await service.findResult('att-1', 'user-1');

      expect(res.cat).toMatchObject({
        ability: 2.5,
        standardError: 0.3,
        stoppedBy: 'PRECISION',
        maxItems: 2,
      });
      expect(res.cat!.passLikelihood).toBeGreaterThan(50);
      // 50% correct would fail on percentage, but the measured level passes.
      expect(res.passed).toBe(true);
    });
  });

  describe('closeExpiredBatch (cleanup job)', () => {
    const now = new Date('2026-09-28T12:00:00Z');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('closes every attempt past its deadline, counting the outcomes', async () => {
      mockPrismaService.examAttempt.findMany.mockResolvedValue([
        {
          id: 'expired-with-answers',
          startedAt: new Date('2026-09-28T09:00:00Z'),
          expiresAt: new Date('2026-09-28T10:00:00Z'),
          exam: { timeLimit: 60 },
        },
        {
          id: 'expired-empty',
          startedAt: new Date('2026-09-28T09:00:00Z'),
          expiresAt: new Date('2026-09-28T10:00:00Z'),
          exam: { timeLimit: 60 },
        },
        {
          // Legacy attempt without expiresAt, still inside startedAt + 3h.
          id: 'legacy-running',
          startedAt: new Date('2026-09-28T11:00:00Z'),
          expiresAt: null,
          exam: { timeLimit: 180 },
        },
      ]);
      const close = jest
        .spyOn(service as any, 'closeFromStoredAnswers')
        .mockImplementation(async (id: any) =>
          id === 'expired-empty'
            ? AttemptStatus.ABANDONED
            : AttemptStatus.SUBMITTED,
        );

      const res = await service.closeExpiredBatch(now, 10);

      expect(res).toEqual({ submitted: 1, abandoned: 1 });
      expect(close).toHaveBeenCalledTimes(2);
      expect(close).not.toHaveBeenCalledWith(
        'legacy-running',
        expect.anything(),
      );
      expect(mockPrismaService.examAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: AttemptStatus.IN_PROGRESS }),
          take: 10,
        }),
      );
    });

    it('keeps going when one attempt fails to close', async () => {
      mockPrismaService.examAttempt.findMany.mockResolvedValue([
        {
          id: 'broken',
          startedAt: new Date('2026-09-28T09:00:00Z'),
          expiresAt: new Date('2026-09-28T10:00:00Z'),
          exam: { timeLimit: 60 },
        },
        {
          id: 'ok',
          startedAt: new Date('2026-09-28T09:00:00Z'),
          expiresAt: new Date('2026-09-28T10:00:00Z'),
          exam: { timeLimit: 60 },
        },
      ]);
      jest
        .spyOn(service as any, 'closeFromStoredAnswers')
        .mockImplementation(async (id: any) => {
          if (id === 'broken') throw new Error('boom');
          return AttemptStatus.SUBMITTED;
        });

      await expect(service.closeExpiredBatch(now)).resolves.toEqual({
        submitted: 1,
        abandoned: 0,
      });
    });
  });
});
