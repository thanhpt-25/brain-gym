export const EXAM_CLEANUP_QUEUE = 'exam-cleanup';
export const EXAM_CLEANUP_JOB = 'exam-cleanup-scan';
/** Hourly, off the top of the hour. */
export const EXAM_CLEANUP_PATTERN = '17 * * * *';

/** Answer-less ABANDONED attempts are deleted once this old. */
export const ABANDONED_RETENTION_DAYS = 1;
/** Practice exams nobody attempts (any more) are deleted once this old. */
export const PRACTICE_EXAM_RETENTION_DAYS = 7;
/** Rows handled per run, so one run never holds the queue for long. */
export const CLEANUP_BATCH = 500;
