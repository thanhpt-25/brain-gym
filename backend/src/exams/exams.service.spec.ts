jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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
});
