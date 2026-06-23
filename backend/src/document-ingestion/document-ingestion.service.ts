import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  COST_PER_PAGE_USD,
  DOCUMENT_INGESTION_JOB,
  DOCUMENT_INGESTION_QUEUE,
  WORDS_PER_PAGE,
} from './document-ingestion.constants';
import { CreateIngestionJobDto } from './dto/create-ingestion-job.dto';

@Injectable()
export class DocumentIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(DOCUMENT_INGESTION_QUEUE) private readonly queue: Queue,
  ) {}

  async estimate(fileBuffer: Buffer, certificationId: string) {
    const wordCount = fileBuffer
      .toString('utf8')
      .split(/\s+/)
      .filter(Boolean).length;
    const estimatedPages = Math.max(1, Math.ceil(wordCount / WORDS_PER_PAGE));
    const estimatedCostUsd = estimatedPages * COST_PER_PAGE_USD;

    return {
      wordCount,
      estimatedPages,
      estimatedCostUsd: +estimatedCostUsd.toFixed(4),
      certificationId,
    };
  }

  async createJob(
    fileBuffer: Buffer,
    originalName: string,
    dto: CreateIngestionJobDto,
    userId: string,
  ) {
    if (!dto.rightsAttestation) {
      throw new BadRequestException(
        'You must attest that you have rights to use this content',
      );
    }

    const contentHash = createHash('sha256').update(fileBuffer).digest('hex');

    // Content-hash dedup: reject if identical content already ingested
    const duplicate = await this.prisma.documentIngestionJob.findFirst({
      where: { certificationId: dto.certificationId, contentHash },
      select: { id: true, status: true },
    });
    if (duplicate) {
      throw new BadRequestException(
        `This document has already been ingested (job ${duplicate.id})`,
      );
    }

    const wordCount = fileBuffer
      .toString('utf8')
      .split(/\s+/)
      .filter(Boolean).length;
    const estimatedPages = Math.max(1, Math.ceil(wordCount / WORDS_PER_PAGE));
    const estimatedCostUsd = estimatedPages * COST_PER_PAGE_USD;

    const job = await this.prisma.documentIngestionJob.create({
      data: {
        userId,
        certificationId: dto.certificationId,
        fileName: originalName,
        fileUrl: '',
        fileSizeBytes: fileBuffer.length,
        contentHash,
        rightsAttestation: dto.rightsAttestation,
        declaredSource: dto.declaredSource,
        estimatedCostUsd: +estimatedCostUsd.toFixed(4),
      },
    });

    await this.queue.add(
      DOCUMENT_INGESTION_JOB,
      { jobId: job.id, content: fileBuffer.toString('utf8') },
      { jobId: `doc-ingest:${job.id}` },
    );

    return job;
  }

  async listJobs(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.documentIngestionJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.documentIngestionJob.count({ where: { userId } }),
    ]);
    return { data, total, page, limit };
  }

  async getJob(jobId: string, userId: string) {
    const job = await this.prisma.documentIngestionJob.findUnique({
      where: { id: jobId },
      include: { _count: { select: { questions: true } } },
    });
    if (!job || job.userId !== userId) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }
}
