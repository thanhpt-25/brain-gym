import { Test, TestingModule } from '@nestjs/testing';
import { QuestionsService } from './questions.service';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';

const mockPrisma = {
  question: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  choice: { deleteMany: jest.fn(), createMany: jest.fn() },
  questionTag: { deleteMany: jest.fn(), createMany: jest.fn() },
  tag: { upsert: jest.fn() },
  vote: { findUnique: jest.fn() },
  readinessScore: { findMany: jest.fn() },
};

const mockGamification = {
  awardPoints: jest.fn().mockResolvedValue(undefined),
};
const mockKg = {
  enqueueOverlapCompute: jest.fn().mockResolvedValue({ jobId: 'job-1' }),
};

describe('QuestionsService — real-time KG recompute on domain change (US-1103)', () => {
  let service: QuestionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    delete process.env.KG_RECOMPUTE_DEBOUNCE_MS;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GamificationService, useValue: mockGamification },
        { provide: KnowledgeGraphService, useValue: mockKg },
      ],
    }).compile();

    service = module.get(QuestionsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const existingQuestion = {
    id: 'q-1',
    certificationId: 'cert-1',
    domainId: 'domain-old',
    deletedAt: null,
    status: 'APPROVED',
  };

  const updateResult = {
    id: 'q-1',
    certificationId: 'cert-1',
    domainId: 'domain-new',
    deletedAt: null,
    status: 'APPROVED',
    author: { id: 'u-1', displayName: 'User', avatarUrl: null },
    certification: { id: 'cert-1', name: 'AWS SAA', code: 'SAA-C03' },
    domain: { id: 'domain-new', name: 'Security' },
    choices: [],
    tags: [],
  };

  it('enqueues overlap recompute after debounce when domain changes', async () => {
    mockPrisma.question.findUnique.mockResolvedValue(existingQuestion);
    mockPrisma.choice.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.questionTag.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.question.update.mockResolvedValue(updateResult);

    await service.adminUpdate('q-1', { domainId: 'domain-new' });

    expect(mockKg.enqueueOverlapCompute).not.toHaveBeenCalled();

    // RECOMPUTE_DEBOUNCE_MS is a module-level constant (default 5000ms); advance past it
    jest.advanceTimersByTime(6000);
    await Promise.resolve();

    expect(mockKg.enqueueOverlapCompute).toHaveBeenCalledWith('cert-1');
  });

  it('does not enqueue recompute when domain does not change', async () => {
    mockPrisma.question.findUnique.mockResolvedValue(existingQuestion);
    mockPrisma.choice.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.questionTag.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.question.update.mockResolvedValue({
      ...updateResult,
      domainId: 'domain-old',
    });

    await service.adminUpdate('q-1', { domainId: 'domain-old' });

    jest.advanceTimersByTime(10000);
    await Promise.resolve();

    expect(mockKg.enqueueOverlapCompute).not.toHaveBeenCalled();
  });

  it('does not enqueue recompute when domainId is absent from the update dto', async () => {
    mockPrisma.question.findUnique.mockResolvedValue(existingQuestion);
    mockPrisma.choice.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.questionTag.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.question.update.mockResolvedValue(updateResult);

    await service.adminUpdate('q-1', { title: 'Updated title' } as any);

    jest.advanceTimersByTime(10000);
    await Promise.resolve();

    expect(mockKg.enqueueOverlapCompute).not.toHaveBeenCalled();
  });

  it('debounces burst edits — only one enqueue fires for rapid successive updates', async () => {
    mockPrisma.question.findUnique.mockResolvedValue(existingQuestion);
    mockPrisma.choice.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.questionTag.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.question.update.mockResolvedValue(updateResult);

    // Three updates within a short window — each resets the debounce timer
    await service.adminUpdate('q-1', { domainId: 'domain-new' });
    jest.advanceTimersByTime(1000);
    await service.adminUpdate('q-1', { domainId: 'domain-new' });
    jest.advanceTimersByTime(1000);
    await service.adminUpdate('q-1', { domainId: 'domain-new' });

    // 2000ms elapsed since last update; debounce timer (5000ms) still pending
    expect(mockKg.enqueueOverlapCompute).not.toHaveBeenCalled();

    // Advance past the debounce window to fire the final timer
    jest.advanceTimersByTime(5500);
    await Promise.resolve();

    expect(mockKg.enqueueOverlapCompute).toHaveBeenCalledTimes(1);
    expect(mockKg.enqueueOverlapCompute).toHaveBeenCalledWith('cert-1');
  });
});
