import { ExamCleanupScheduler } from './exam-cleanup.scheduler';
import {
  EXAM_CLEANUP_JOB,
  EXAM_CLEANUP_PATTERN,
} from './exam-cleanup.constants';

describe('ExamCleanupScheduler', () => {
  const queue = {
    getRepeatableJobs: jest.fn(),
    add: jest.fn(),
    removeRepeatableByKey: jest.fn(),
  };
  const scheduler = new ExamCleanupScheduler(queue as any);

  beforeEach(() => jest.clearAllMocks());

  it('registers the hourly repeatable job', async () => {
    queue.getRepeatableJobs.mockResolvedValue([]);
    await scheduler.onModuleInit();
    expect(queue.add).toHaveBeenCalledWith(
      EXAM_CLEANUP_JOB,
      {},
      expect.objectContaining({
        repeat: { pattern: EXAM_CLEANUP_PATTERN },
        jobId: EXAM_CLEANUP_JOB,
      }),
    );
  });

  it('does not register it twice', async () => {
    queue.getRepeatableJobs.mockResolvedValue([
      { name: EXAM_CLEANUP_JOB, pattern: EXAM_CLEANUP_PATTERN, key: 'k' },
    ]);
    await scheduler.onModuleInit();
    expect(queue.add).not.toHaveBeenCalled();
    expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
  });

  it('replaces a schedule with an outdated pattern', async () => {
    queue.getRepeatableJobs.mockResolvedValue([
      { name: EXAM_CLEANUP_JOB, pattern: '0 * * * *', key: 'old' },
    ]);
    await scheduler.onModuleInit();
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('old');
    expect(queue.add).toHaveBeenCalled();
  });

  it('does not crash the app when Redis is unavailable', async () => {
    queue.getRepeatableJobs.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(scheduler.onModuleInit()).resolves.toBeUndefined();
  });
});
