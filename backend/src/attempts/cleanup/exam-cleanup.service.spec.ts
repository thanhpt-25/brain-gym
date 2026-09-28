import { ExamCleanupService } from './exam-cleanup.service';

describe('ExamCleanupService', () => {
  const now = new Date('2026-09-28T12:00:00Z');
  const prisma = {
    examAttempt: { findMany: jest.fn(), deleteMany: jest.fn() },
    exam: { findMany: jest.fn(), deleteMany: jest.fn() },
  };
  const attempts = { closeExpiredBatch: jest.fn() };
  const service = new ExamCleanupService(prisma as any, attempts as any);

  beforeEach(() => {
    jest.clearAllMocks();
    attempts.closeExpiredBatch.mockResolvedValue({
      submitted: 2,
      abandoned: 3,
    });
    prisma.examAttempt.findMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
    prisma.examAttempt.deleteMany.mockResolvedValue({ count: 2 });
    prisma.exam.findMany.mockResolvedValue([{ id: 'e1' }]);
    prisma.exam.deleteMany.mockResolvedValue({ count: 1 });
  });

  it('closes expired attempts, then deletes empty abandoned attempts and unused practice exams', async () => {
    const report = await service.run(now);

    expect(report).toEqual({
      submitted: 2,
      abandoned: 3,
      deletedAttempts: 2,
      deletedExams: 1,
    });
    expect(attempts.closeExpiredBatch).toHaveBeenCalledWith(now, 500);
    // Closing runs first so attempts it abandons are not yet old enough to delete.
    expect(attempts.closeExpiredBatch.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.examAttempt.findMany.mock.invocationCallOrder[0],
    );
  });

  it('only deletes ABANDONED attempts older than a day with no answers or captured words', async () => {
    await service.run(now);

    expect(prisma.examAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ABANDONED',
          startedAt: { lt: new Date('2026-09-27T12:00:00Z') },
          answers: { none: {} },
          capturedWords: { none: {} },
        },
      }),
    );
    expect(prisma.examAttempt.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['a1', 'a2'] },
        status: 'ABANDONED',
        answers: { none: {} },
      },
    });
  });

  it('only deletes practice exams older than a week that have no attempts', async () => {
    await service.run(now);

    expect(prisma.exam.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isPractice: true,
          createdAt: { lt: new Date('2026-09-21T12:00:00Z') },
          attempts: { none: {} },
        },
      }),
    );
    expect(prisma.exam.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['e1'] }, isPractice: true, attempts: { none: {} } },
    });
  });

  it('skips the deletes when there is nothing to delete', async () => {
    prisma.examAttempt.findMany.mockResolvedValue([]);
    prisma.exam.findMany.mockResolvedValue([]);

    const report = await service.run(now);

    expect(report.deletedAttempts).toBe(0);
    expect(report.deletedExams).toBe(0);
    expect(prisma.examAttempt.deleteMany).not.toHaveBeenCalled();
    expect(prisma.exam.deleteMany).not.toHaveBeenCalled();
  });
});
