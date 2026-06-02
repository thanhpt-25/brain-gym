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
});
