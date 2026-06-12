import { Job } from 'bullmq';
import { MaterialConversionProcessor } from './material-conversion.processor';
import { MaterialConversionJobData } from './material-conversion.job.interface';

/**
 * Regression coverage for #93: the S3 temp object must survive across BullMQ
 * retries so a transient failure on attempt 1 doesn't permanently break the
 * material. It may only be deleted on success or the final failed attempt.
 */
describe('MaterialConversionProcessor', () => {
  const S3_BUCKET = 'tmp-materials';
  const S3_KEY = 'uploads/material-123.pdf';

  let prisma: {
    sourceChunk: { createMany: jest.Mock };
    sourceMaterial: { update: jest.Mock };
  };
  let s3Upload: { deleteTemp: jest.Mock };
  let processor: MaterialConversionProcessor;

  const makeJob = (
    attemptsMade: number,
    attempts: number,
    data: Partial<MaterialConversionJobData> = {},
  ): Job<MaterialConversionJobData> =>
    ({
      attemptsMade,
      opts: { attempts },
      data: {
        materialId: 'material-123',
        filename: 'spec.pdf',
        s3Bucket: S3_BUCKET,
        s3Key: S3_KEY,
        ...data,
      },
    }) as unknown as Job<MaterialConversionJobData>;

  beforeEach(() => {
    prisma = {
      sourceChunk: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      sourceMaterial: { update: jest.fn().mockResolvedValue({}) },
    };
    s3Upload = { deleteTemp: jest.fn().mockResolvedValue(undefined) };
    processor = new MaterialConversionProcessor(prisma as any, s3Upload as any);
  });

  const mockConvert = (impl: () => Promise<string>) =>
    jest.spyOn(processor as any, 'convertToMarkdown').mockImplementation(impl);

  it('deletes the S3 temp object after a successful conversion', async () => {
    mockConvert(async () => '# Hello\n\nSome content.');

    await processor.process(makeJob(0, 3));

    expect(prisma.sourceMaterial.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ready' }),
      }),
    );
    expect(s3Upload.deleteTemp).toHaveBeenCalledWith(S3_BUCKET, S3_KEY);
  });

  it('keeps the S3 temp object on a non-final failed attempt and stays processing', async () => {
    mockConvert(async () => {
      throw new Error('Lambda throttled');
    });

    // attempt 1 of 3 (attemptsMade=0) — retries remain.
    await expect(processor.process(makeJob(0, 3))).rejects.toThrow(
      'Lambda throttled',
    );

    expect(s3Upload.deleteTemp).not.toHaveBeenCalled();
    // Must NOT flip to 'failed' while retries are pending.
    expect(prisma.sourceMaterial.update).not.toHaveBeenCalled();
  });

  it('deletes the S3 temp object and marks failed on the final attempt', async () => {
    mockConvert(async () => {
      throw new Error('Lambda throttled');
    });

    // attempt 3 of 3 (attemptsMade=2) — no retry left.
    await expect(processor.process(makeJob(2, 3))).rejects.toThrow(
      'Lambda throttled',
    );

    expect(s3Upload.deleteTemp).toHaveBeenCalledWith(S3_BUCKET, S3_KEY);
    expect(prisma.sourceMaterial.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'failed' } }),
    );
  });

  it('treats empty markdown as a retryable failure (temp preserved when retries remain)', async () => {
    mockConvert(async () => '   ');

    await expect(processor.process(makeJob(0, 3))).rejects.toThrow(
      /empty content/i,
    );

    expect(s3Upload.deleteTemp).not.toHaveBeenCalled();
    expect(prisma.sourceMaterial.update).not.toHaveBeenCalled();
  });

  it('handles a single-attempt job (no retries) by cleaning up on failure', async () => {
    mockConvert(async () => {
      throw new Error('boom');
    });

    // opts.attempts undefined -> defaults to 1, so attempt 1 is also the last.
    const job = makeJob(0, undefined as unknown as number);
    await expect(processor.process(job)).rejects.toThrow('boom');

    expect(s3Upload.deleteTemp).toHaveBeenCalledWith(S3_BUCKET, S3_KEY);
    expect(prisma.sourceMaterial.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'failed' } }),
    );
  });
});
