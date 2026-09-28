jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ExamsService } from './exams.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ExamsService', () => {
  let service: ExamsService;

  const mockPrismaService: any = {
    exam: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    examAttempt: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    answer: {
      groupBy: jest.fn(),
    },
    certification: {
      findUnique: jest.fn(),
    },
    question: {
      findMany: jest.fn(),
    },
    examQuestion: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  // Run the transaction callback with the same mock as the transaction client.
  mockPrismaService.$transaction.mockImplementation(
    (cb: (tx: any) => unknown) => cb(mockPrismaService),
  );

  // An exam as returned by Prisma, including the answer-revealing fields
  // (`choice.isCorrect`, `question.explanation`) that must NOT leak to the
  // public, unauthenticated read endpoints.
  const examWithAnswers = () => ({
    id: 'exam-1',
    title: 'AWS SAA Mock #1',
    shareCode: 'abc123def456',
    certification: { id: 'cert-1', name: 'AWS SAA', domains: [] },
    author: { id: 'user-1', displayName: 'Alice' },
    examQuestions: [
      {
        sortOrder: 0,
        question: {
          id: 'q-1',
          title: 'Which service is serverless compute?',
          explanation: 'Lambda runs code without managing servers.',
          domain: { id: 'd-1', name: 'Compute' },
          choices: [
            {
              id: 'c-1',
              label: 'A',
              content: 'EC2',
              isCorrect: false,
              sortOrder: 0,
            },
            {
              id: 'c-2',
              label: 'B',
              content: 'Lambda',
              isCorrect: true,
              sortOrder: 1,
            },
          ],
        },
      },
    ],
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ExamsService>(ExamsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('removes the answer key (choice.isCorrect and question.explanation)', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(examWithAnswers());

      const result = await service.findOne('exam-1');

      const question = result.examQuestions[0].question;
      expect(question).not.toHaveProperty('explanation');
      for (const choice of question.choices) {
        expect(choice).not.toHaveProperty('isCorrect');
      }
    });

    it('preserves the public choice fields (id, label, content)', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(examWithAnswers());

      const result = await service.findOne('exam-1');

      expect(result.examQuestions[0].question.choices).toEqual([
        { id: 'c-1', label: 'A', content: 'EC2', sortOrder: 0 },
        { id: 'c-2', label: 'B', content: 'Lambda', sortOrder: 1 },
      ]);
    });

    it('preserves top-level exam metadata', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(examWithAnswers());

      const result = await service.findOne('exam-1');

      expect(result.id).toBe('exam-1');
      expect(result.title).toBe('AWS SAA Mock #1');
      expect(result.certification.name).toBe('AWS SAA');
    });

    it('throws NotFoundException when the exam does not exist', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findByShareCode', () => {
    it('removes the answer key (choice.isCorrect and question.explanation)', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(examWithAnswers());

      const result = await service.findByShareCode('abc123def456');

      const question = result.examQuestions[0].question;
      expect(question).not.toHaveProperty('explanation');
      for (const choice of question.choices) {
        expect(choice).not.toHaveProperty('isCorrect');
      }
    });

    it('throws NotFoundException for an unknown share code', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(null);

      await expect(service.findByShareCode('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const ownedExam = {
      id: 'exam-1',
      createdBy: 'user-1',
      certificationId: 'cert-1',
    };

    it('throws NotFoundException when the exam does not exist', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'missing', { title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the user is not the owner', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(ownedExam);

      await expect(
        service.update('intruder', 'exam-1', { title: 'x' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('updates metadata only without touching the question set', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(ownedExam);
      mockPrismaService.exam.update.mockResolvedValue({ id: 'exam-1' });

      await service.update('user-1', 'exam-1', { title: 'New Title' });

      expect(mockPrismaService.exam.update).toHaveBeenCalledWith({
        where: { id: 'exam-1' },
        data: { title: 'New Title' },
        include: { certification: true },
      });
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockPrismaService.examQuestion.deleteMany).not.toHaveBeenCalled();
    });

    it('replaces the question set and recomputes questionCount', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(ownedExam);
      mockPrismaService.question.findMany.mockResolvedValue([
        { id: 'q-1' },
        { id: 'q-2' },
      ]);
      mockPrismaService.exam.update.mockResolvedValue({ id: 'exam-1' });

      await service.update('user-1', 'exam-1', { questionIds: ['q-1', 'q-2'] });

      expect(mockPrismaService.examQuestion.deleteMany).toHaveBeenCalledWith({
        where: { examId: 'exam-1' },
      });
      expect(mockPrismaService.examQuestion.createMany).toHaveBeenCalledWith({
        data: [
          { examId: 'exam-1', questionId: 'q-1', sortOrder: 0 },
          { examId: 'exam-1', questionId: 'q-2', sortOrder: 1 },
        ],
      });
      expect(mockPrismaService.exam.update).toHaveBeenCalledWith({
        where: { id: 'exam-1' },
        data: { questionCount: 2 },
        include: { certification: true },
      });
    });

    it('rejects questions that do not belong to the exam certification', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(ownedExam);
      // Only one of the two requested questions is valid for this certification.
      mockPrismaService.question.findMany.mockResolvedValue([{ id: 'q-1' }]);

      await expect(
        service.update('user-1', 'exam-1', {
          questionIds: ['q-1', 'q-foreign'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockPrismaService.examQuestion.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const exam = { id: 'exam-1', createdBy: 'user-1', deletedAt: null };

    it('hard-deletes an exam that has never been attempted', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(exam);
      mockPrismaService.examAttempt.count.mockResolvedValue(0);

      await expect(
        service.remove('user-1', 'USER' as any, 'exam-1'),
      ).resolves.toEqual({ deleted: true });
      expect(mockPrismaService.exam.delete).toHaveBeenCalledWith({
        where: { id: 'exam-1' },
      });
      expect(mockPrismaService.exam.update).not.toHaveBeenCalled();
    });

    it('soft-deletes an exam that already has attempts (FK is RESTRICT)', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(exam);
      mockPrismaService.examAttempt.count.mockResolvedValue(3);

      await expect(
        service.remove('user-1', 'USER' as any, 'exam-1'),
      ).resolves.toEqual({ deleted: true });
      expect(mockPrismaService.exam.delete).not.toHaveBeenCalled();
      expect(mockPrismaService.exam.update).toHaveBeenCalledWith({
        where: { id: 'exam-1' },
        data: { deletedAt: expect.any(Date), shareCode: null },
      });
    });

    it('throws NotFoundException for an already soft-deleted exam', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({
        ...exam,
        deletedAt: new Date(),
      });

      await expect(
        service.remove('user-1', 'USER' as any, 'exam-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when a non-owner non-admin deletes', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(exam);

      await expect(
        service.remove('user-2', 'USER' as any, 'exam-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('resolveBlueprint', () => {
    // resolveBlueprint is private; cast to reach it directly so each axis can
    // be exercised in isolation without the surrounding create/update plumbing.
    const resolve = (blueprint: any) =>
      (service as any).resolveBlueprint('cert-1', blueprint) as Promise<
        string[]
      >;

    it('fills difficulty buckets from the approved pool (existing behaviour)', async () => {
      mockPrismaService.question.findMany.mockImplementation(
        ({ where }: any) => {
          if (where.difficulty === 'EASY')
            return Promise.resolve([{ id: 'e-1' }, { id: 'e-2' }, { id: 'e-3' }]);
          if (where.difficulty === 'HARD')
            return Promise.resolve([{ id: 'h-1' }, { id: 'h-2' }]);
          return Promise.resolve([]);
        },
      );

      const ids = await resolve({ byDifficulty: { EASY: 2, HARD: 1 } });

      expect(ids).toHaveLength(3);
      // Two EASY picks and one HARD pick, scoped to the requested buckets.
      expect(ids.filter((id) => id.startsWith('e-'))).toHaveLength(2);
      expect(ids.filter((id) => id.startsWith('h-'))).toHaveLength(1);
    });

    it('fills domain buckets, querying by domainId and APPROVED status', async () => {
      mockPrismaService.question.findMany.mockImplementation(
        ({ where }: any) => {
          if (where.domainId === 'dom-a')
            return Promise.resolve([{ id: 'a-1' }, { id: 'a-2' }, { id: 'a-3' }]);
          if (where.domainId === 'dom-b')
            return Promise.resolve([{ id: 'b-1' }, { id: 'b-2' }]);
          return Promise.resolve([]);
        },
      );

      const ids = await resolve({ byDomain: { 'dom-a': 2, 'dom-b': 1 } });

      expect(ids).toHaveLength(3);
      expect(ids.filter((id) => id.startsWith('a-'))).toHaveLength(2);
      expect(ids.filter((id) => id.startsWith('b-'))).toHaveLength(1);

      // Each domain bucket is scoped to certification + APPROVED + non-deleted.
      const calls = mockPrismaService.question.findMany.mock.calls.map(
        (c: any[]) => c[0].where,
      );
      expect(calls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            certificationId: 'cert-1',
            status: 'APPROVED',
            deletedAt: null,
            domainId: 'dom-a',
          }),
        ]),
      );
    });

    it('throws 422 with shortage detail when a domain bucket is under-filled', async () => {
      mockPrismaService.question.findMany.mockImplementation(
        ({ where }: any) => {
          if (where.domainId === 'dom-a') return Promise.resolve([{ id: 'a-1' }]);
          return Promise.resolve([]);
        },
      );

      await expect(
        resolve({ byDomain: { 'dom-a': 5 } }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects mixing difficulty and domain quotas in one blueprint', async () => {
      await expect(
        resolve({ byDifficulty: { EASY: 1 }, byDomain: { 'dom-a': 1 } }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an empty blueprint (all counts zero / absent)', async () => {
      await expect(
        resolve({ byDifficulty: { EASY: 0 }, byDomain: {} }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects more domain buckets than the allowed maximum', async () => {
      const byDomain: Record<string, number> = {};
      for (let i = 0; i < 51; i++) byDomain[`dom-${i}`] = 1;

      await expect(resolve({ byDomain })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      // Rejected before any query fan-out.
      expect(mockPrismaService.question.findMany).not.toHaveBeenCalled();
    });

    it('rejects a non-integer domain quota', async () => {
      await expect(
        resolve({ byDomain: { 'dom-a': 2.5 } }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a domain quota above the per-bucket maximum', async () => {
      await expect(
        resolve({ byDomain: { 'dom-a': 201 } }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('createPractice', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockPrismaService.certification.findUnique.mockResolvedValue({
        id: 'cert-1',
        code: 'SAA',
        domains: [
          { id: 'd1', weight: '75.00' },
          { id: 'd2', weight: '25.00' },
        ],
      });
      mockPrismaService.question.findMany.mockResolvedValue([
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `d1-${i}`,
          domainId: 'd1',
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `d2-${i}`,
          domainId: 'd2',
        })),
      ]);
      mockPrismaService.examAttempt.findMany.mockResolvedValue([]);
      mockPrismaService.exam.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'exam-1', ...data }),
      );
    });

    it('creates a private practice exam following the domain weights', async () => {
      await service.createPractice('user-1', {
        certificationId: 'cert-1',
        questionCount: 8,
        timeLimit: 12,
        timerMode: 'TIME_PRESSURE' as any,
      });

      const { data } = mockPrismaService.exam.create.mock.calls[0][0];
      expect(data).toMatchObject({
        title: 'SAA Time Pressure Exam',
        visibility: 'PRIVATE',
        isPractice: true,
        createdBy: 'user-1',
        questionCount: 8,
        timeLimit: 12,
      });
      const ids = data.examQuestions.create.map((q: any) => q.questionId);
      expect(ids.filter((id: string) => id.startsWith('d1'))).toHaveLength(6);
      expect(ids.filter((id: string) => id.startsWith('d2'))).toHaveLength(2);
      expect(mockPrismaService.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'APPROVED',
            deletedAt: null,
          }),
        }),
      );
    });

    it("skips the questions from the learner's latest attempts when it can", async () => {
      mockPrismaService.question.findMany.mockResolvedValue([
        { id: 'a', domainId: 'd1' },
        { id: 'b', domainId: 'd1' },
        { id: 'c', domainId: 'd1' },
      ]);
      mockPrismaService.examAttempt.findMany.mockResolvedValue([
        { id: 'att-2', answers: [{ questionId: 'a', isCorrect: true }] },
        { id: 'att-1', answers: [{ questionId: 'b', isCorrect: true }] },
        { id: 'att-0', answers: [{ questionId: 'c', isCorrect: false }] },
      ]);

      await service.createPractice('user-1', {
        certificationId: 'cert-1',
        questionCount: 1,
        timeLimit: 5,
      });

      const { data } = mockPrismaService.exam.create.mock.calls[0][0];
      // a and b were in the 2 latest attempts; c was missed longer ago.
      expect(data.examQuestions.create).toEqual([
        { questionId: 'c', sortOrder: 0 },
      ]);
    });

    it('404s for an unknown certification and 422s for an empty pool', async () => {
      mockPrismaService.certification.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.createPractice('user-1', {
          certificationId: 'nope',
          questionCount: 1,
          timeLimit: 5,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      mockPrismaService.question.findMany.mockResolvedValue([]);
      await expect(
        service.createPractice('user-1', {
          certificationId: 'cert-1',
          questionCount: 1,
          timeLimit: 5,
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('create (random mode)', () => {
    it('only draws approved, non-deleted questions', async () => {
      jest.clearAllMocks();
      mockPrismaService.question.findMany.mockResolvedValue([{ id: 'q1' }]);
      mockPrismaService.exam.create.mockResolvedValue({ id: 'exam-1' });

      await service.create('user-1', {
        title: 'T',
        certificationId: 'cert-1',
        questionCount: 1,
        timeLimit: 5,
      });

      expect(mockPrismaService.question.findMany).toHaveBeenCalledWith({
        where: {
          certificationId: 'cert-1',
          status: 'APPROVED',
          deletedAt: null,
        },
        select: { id: true },
      });
    });
  });

  describe('findMyExams', () => {
    it('hides auto-generated practice exams', async () => {
      mockPrismaService.exam.count.mockResolvedValue(0);
      mockPrismaService.exam.findMany.mockResolvedValue([]);
      await service.findMyExams('user-1');
      expect(mockPrismaService.exam.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { createdBy: 'user-1', deletedAt: null, isPractice: false },
        }),
      );
    });
  });

  describe('createPractice modes', () => {
    const q = (id: string, domainId: string, difficulty = 'MEDIUM') => ({
      id,
      domainId,
      difficulty,
    });

    beforeEach(() => {
      jest.clearAllMocks();
      mockPrismaService.certification.findUnique.mockResolvedValue({
        id: 'cert-1',
        code: 'SAA',
        domains: [
          { id: 'd1', weight: null },
          { id: 'd2', weight: null },
        ],
      });
      mockPrismaService.examAttempt.findMany.mockResolvedValue([]);
      mockPrismaService.answer.groupBy.mockResolvedValue([]);
      mockPrismaService.exam.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'exam-1', ...data }),
      );
    });

    const created = () => mockPrismaService.exam.create.mock.calls[0][0].data;
    const pickedIds = () =>
      created().examQuestions.create.map((x: any) => x.questionId);

    it('QUICK_DRILL narrows the pool to the chosen domains and difficulties', async () => {
      mockPrismaService.question.findMany.mockResolvedValue([q('a', 'd1')]);

      await service.createPractice('user-1', {
        certificationId: 'cert-1',
        questionCount: 10,
        timeLimit: 15,
        mode: 'QUICK_DRILL' as any,
        domainIds: ['d1'],
        difficulties: ['HARD' as any],
      });

      expect(mockPrismaService.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            domainId: { in: ['d1'] },
            difficulty: { in: ['HARD'] },
          }),
        }),
      );
      expect(created()).toMatchObject({
        title: 'SAA Quick Drill',
        practiceMode: 'QUICK_DRILL',
      });
    });

    it('REVIEW redoes only the missed and flagged questions of an attempt', async () => {
      mockPrismaService.question.findMany.mockResolvedValue([
        q('right', 'd1'),
        q('wrong', 'd1'),
        q('skipped', 'd2'),
        q('flagged', 'd2'),
        q('other', 'd2'),
      ]);
      mockPrismaService.examAttempt.findUnique.mockResolvedValue({
        userId: 'user-1',
        status: 'SUBMITTED',
        answers: [
          { questionId: 'right', isCorrect: true, isMarked: false },
          { questionId: 'wrong', isCorrect: false, isMarked: false },
          { questionId: 'skipped', isCorrect: false, isMarked: false },
          { questionId: 'flagged', isCorrect: true, isMarked: true },
        ],
      });

      await service.createPractice('user-1', {
        certificationId: 'cert-1',
        questionCount: 20,
        timeLimit: 10,
        mode: 'REVIEW' as any,
        sourceAttemptId: 'att-1',
      });

      expect(new Set(pickedIds())).toEqual(
        new Set(['wrong', 'skipped', 'flagged']),
      );
      expect(created().title).toBe('SAA Mistake Review');
    });

    it("REVIEW refuses someone else's attempt", async () => {
      mockPrismaService.question.findMany.mockResolvedValue([q('a', 'd1')]);
      mockPrismaService.examAttempt.findUnique.mockResolvedValue({
        userId: 'user-2',
        status: 'SUBMITTED',
        answers: [],
      });
      await expect(
        service.createPractice('user-1', {
          certificationId: 'cert-1',
          questionCount: 5,
          timeLimit: 5,
          mode: 'REVIEW' as any,
          sourceAttemptId: 'att-9',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('REVIEW without an attempt uses everything missed or flagged so far', async () => {
      mockPrismaService.question.findMany.mockResolvedValue([
        q('a', 'd1'),
        q('b', 'd1'),
        q('c', 'd1'),
      ]);
      mockPrismaService.examAttempt.findMany.mockResolvedValue([
        {
          id: 'att-2',
          answers: [
            { questionId: 'a', isCorrect: false, isMarked: false },
            { questionId: 'b', isCorrect: true, isMarked: false },
          ],
        },
      ]);

      await service.createPractice('user-1', {
        certificationId: 'cert-1',
        questionCount: 5,
        timeLimit: 5,
        mode: 'REVIEW' as any,
      });
      expect(pickedIds()).toEqual(['a']);
    });

    it('REVIEW with nothing to review is a 422', async () => {
      mockPrismaService.question.findMany.mockResolvedValue([q('a', 'd1')]);
      await expect(
        service.createPractice('user-1', {
          certificationId: 'cert-1',
          questionCount: 5,
          timeLimit: 5,
          mode: 'REVIEW' as any,
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('ADAPTIVE picks questions near the learner level', async () => {
      // A strong learner: 10 hard questions answered right.
      const answered = Array.from({ length: 10 }, (_, i) => `h${i}`);
      mockPrismaService.examAttempt.findMany.mockResolvedValue([
        {
          id: 'att-1',
          answers: answered.map((id) => ({
            questionId: id,
            isCorrect: true,
            isMarked: false,
          })),
        },
        { id: 'att-0', answers: [] },
        { id: 'att-00', answers: [] },
      ]);
      mockPrismaService.question.findMany.mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.id
            ? answered.map((id) => q(id, 'd1', 'HARD'))
            : [
                ...Array.from({ length: 5 }, (_, i) =>
                  q(`easy${i}`, 'd1', 'EASY'),
                ),
                ...Array.from({ length: 5 }, (_, i) =>
                  q(`hard${i}`, 'd1', 'HARD'),
                ),
              ],
        ),
      );

      await service.createPractice('user-1', {
        certificationId: 'cert-1',
        questionCount: 5,
        timeLimit: 5,
        mode: 'ADAPTIVE' as any,
      });

      expect(pickedIds().every((id: string) => id.startsWith('hard'))).toBe(
        true,
      );
      expect(created()).toMatchObject({
        title: 'SAA Adaptive Practice',
        practiceMode: 'ADAPTIVE',
      });
    });
  });

  describe('abilityFor', () => {
    it('is the neutral prior for a learner without history', async () => {
      mockPrismaService.examAttempt.findMany.mockResolvedValue([]);
      expect(await service.abilityFor('user-1', 'cert-1')).toEqual({
        theta: 0,
        se: 1,
        answered: 0,
      });
    });

    it('uses question statistics from all learners', async () => {
      jest.clearAllMocks();
      mockPrismaService.examAttempt.findMany.mockResolvedValue([
        {
          id: 'att-1',
          answers: [{ questionId: 'q1', isCorrect: true, isMarked: false }],
        },
      ]);
      mockPrismaService.question.findMany.mockResolvedValue([
        { id: 'q1', difficulty: 'MEDIUM' },
      ]);
      mockPrismaService.answer.groupBy.mockResolvedValue([
        { questionId: 'q1', isCorrect: true, _count: { _all: 2 } },
        { questionId: 'q1', isCorrect: false, _count: { _all: 38 } },
      ]);

      const { theta, answered } = await service.abilityFor('user-1', 'cert-1');
      expect(answered).toBe(1);
      // Getting a question almost nobody gets right says a lot.
      expect(theta).toBeGreaterThan(0.4);
    });
  });
});

