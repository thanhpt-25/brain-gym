import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from '@aws-sdk/client-lambda';
import { PrismaService } from '../../prisma/prisma.service';
import { S3UploadService } from '../../ai-question-bank/ingestion/s3-upload.service';
import { chunkText } from '../../ai-question-bank/ingestion/chunker';
import {
  MATERIAL_CONVERSION_QUEUE,
  MaterialConversionJobData,
} from './material-conversion.job.interface';

@Processor(MATERIAL_CONVERSION_QUEUE, { concurrency: 2 })
export class MaterialConversionProcessor extends WorkerHost {
  private readonly logger = new Logger(MaterialConversionProcessor.name);
  private readonly lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Upload: S3UploadService,
  ) {
    super();
  }

  async process(job: Job<MaterialConversionJobData>): Promise<void> {
    const { materialId, filename, s3Bucket, s3Key, bufferBase64 } = job.data;
    this.logger.log(`Converting material ${materialId} (${filename})`);

    // Fix #93: BullMQ retries (default attempts: 3) re-run this processor on
    // transient failures. The S3 temp object is the only file source for the
    // production (Lambda) path, so it must survive until no further retry can
    // run — otherwise retries re-download a deleted key and fail with NoSuchKey.
    const maxAttempts = job.opts.attempts ?? 1;
    const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;
    let succeeded = false;

    try {
      const markdown = await this.convertToMarkdown(
        filename,
        s3Bucket,
        s3Key,
        bufferBase64,
      );

      // Fix #5: Treat empty markdown as a conversion failure rather than
      // creating a ready material with 0 chunks that produces no AI context.
      if (!markdown || markdown.trim().length === 0) {
        throw new Error(
          `Markitdown returned empty content for "${filename}". ` +
            'The file may be corrupt, password-protected, or an unsupported format.',
        );
      }

      const chunks = chunkText(markdown);
      await this.prisma.sourceChunk.createMany({
        data: chunks.map((c) => ({
          materialId,
          content: c.content,
          chunkIndex: c.chunkIndex,
          pageNumber: c.pageNumber ?? null,
          sectionTitle: c.sectionTitle ?? null,
          tokenCount: c.tokenCount,
        })),
      });

      await this.prisma.sourceMaterial.update({
        where: { id: materialId },
        data: { status: 'ready', chunkCount: chunks.length },
      });

      succeeded = true;
      this.logger.log(`Material ${materialId} ready — ${chunks.length} chunks`);
    } catch (err) {
      // Fix #93: Only flip the material to `failed` once retries are exhausted.
      // While attempts remain, leave it `processing` so a transient failure
      // doesn't surface a permanent failure the user must re-upload to clear.
      if (isLastAttempt) {
        this.logger.error(
          `Failed to convert material ${materialId} (final attempt): ${err}`,
        );
        await this.prisma.sourceMaterial.update({
          where: { id: materialId },
          data: { status: 'failed' },
        });
      } else {
        this.logger.warn(
          `Conversion attempt ${job.attemptsMade + 1}/${maxAttempts} failed ` +
            `for material ${materialId}, will retry: ${err}`,
        );
      }
      throw err;
    } finally {
      // Fix #93: Clean up the S3 temp object only when no further retry will
      // run — on success or the last failed attempt. Deleting on every attempt
      // defeats BullMQ retries because retries 2..n can no longer re-download
      // the staged file. The 24h S3 lifecycle rule is the safety net for any
      // object left behind on an unexpected exit.
      if (s3Bucket && s3Key && (succeeded || isLastAttempt)) {
        await this.s3Upload.deleteTemp(s3Bucket, s3Key);
      }
    }
  }

  private async convertToMarkdown(
    filename: string,
    s3Bucket?: string,
    s3Key?: string,
    bufferBase64?: string,
  ): Promise<string> {
    const localUrl = process.env.MARKITDOWN_LOCAL_URL;

    if (localUrl) {
      return this.convertViaLocalServer(
        localUrl,
        filename,
        s3Bucket,
        s3Key,
        bufferBase64,
      );
    }

    const lambdaArn = process.env.AWS_MARKITDOWN_LAMBDA_ARN;
    if (!lambdaArn) {
      throw new Error(
        'MARKITDOWN_LOCAL_URL or AWS_MARKITDOWN_LAMBDA_ARN must be set',
      );
    }

    // Fix #2: Validate S3 coords are present before invoking Lambda.
    // In production the job is always populated with s3Bucket/s3Key, but guard
    // explicitly to surface misconfiguration as a clear error rather than a
    // runtime crash on the non-null assertion.
    if (!s3Bucket || !s3Key) {
      throw new Error(
        `Lambda conversion requires s3Bucket and s3Key in job data, ` +
          `but got s3Bucket=${s3Bucket}, s3Key=${s3Key}. ` +
          'Ensure AWS_S3_MATERIALS_TMP_BUCKET is set.',
      );
    }

    return this.convertViaLambda(lambdaArn, s3Bucket, s3Key, filename);
  }

  private async convertViaLambda(
    lambdaArn: string,
    bucket: string,
    key: string,
    filename: string,
  ): Promise<string> {
    const payload = JSON.stringify({ bucket, key, filename });
    const response = await this.lambdaClient.send(
      new InvokeCommand({
        FunctionName: lambdaArn,
        InvocationType: InvocationType.RequestResponse,
        Payload: Buffer.from(payload),
      }),
    );

    if (response.FunctionError) {
      const errorBody = Buffer.from(response.Payload!).toString('utf-8');
      throw new Error(`Lambda error: ${errorBody}`);
    }

    const result = JSON.parse(Buffer.from(response.Payload!).toString('utf-8'));
    return result.markdown as string;
  }

  private async convertViaLocalServer(
    baseUrl: string,
    filename: string,
    s3Bucket?: string,
    s3Key?: string,
    bufferBase64?: string,
  ): Promise<string> {
    let fileBuffer: Buffer;

    if (bufferBase64) {
      fileBuffer = Buffer.from(bufferBase64, 'base64');
    } else if (s3Bucket && s3Key) {
      const { GetObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: process.env.AWS_REGION ?? 'us-east-1',
      });
      const obj = await s3.send(
        new GetObjectCommand({ Bucket: s3Bucket, Key: s3Key }),
      );
      const chunks: Uint8Array[] = [];
      for await (const chunk of obj.Body as any) chunks.push(chunk);
      fileBuffer = Buffer.concat(chunks);
    } else {
      throw new Error('No file source for local conversion');
    }

    // Use Node 18+ built-in FormData + Blob
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(fileBuffer)]), filename);
    form.append('filename', filename);

    const res = await fetch(`${baseUrl}/convert`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok)
      throw new Error(`Markitdown local server error: ${res.statusText}`);
    const json = (await res.json()) as { markdown: string };
    return json.markdown;
  }
}
