import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { MaterialContentType } from '@prisma/client';
import { UploadMaterialDto } from '../dto/upload-material.dto';
import { chunkText } from './chunker';
import { S3UploadService } from './s3-upload.service';
import {
  MATERIAL_CONVERSION_QUEUE,
  MaterialConversionJobData,
} from '../../queues/material-conversion/material-conversion.job.interface';

const MAX_TEXT_LENGTH = 100_000; // ~25k tokens
// Warn when embedding file in Redis job payload (local dev only). 10 MB base64 ≈ 13.3 MB in Redis.
const LOCAL_BUFFER_WARN_BYTES = 10 * 1024 * 1024;

const FILE_CONTENT_TYPES = new Set<MaterialContentType>([
  MaterialContentType.PDF,
  MaterialContentType.DOCX,
  MaterialContentType.PPTX,
  MaterialContentType.XLSX,
]);

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Upload: S3UploadService,
    @InjectQueue(MATERIAL_CONVERSION_QUEUE)
    private readonly conversionQueue: Queue<MaterialConversionJobData>,
  ) {}

  async uploadMaterial(
    userId: string,
    dto: UploadMaterialDto,
    fileBuffer?: Buffer,
    originalFilename?: string,
  ) {
    if (dto.contentType === MaterialContentType.TEXT) {
      return this.uploadTextMaterial(userId, dto);
    }

    if (dto.contentType === MaterialContentType.URL) {
      return this.uploadUrlMaterial(userId, dto);
    }

    if (FILE_CONTENT_TYPES.has(dto.contentType)) {
      if (!fileBuffer || !originalFilename) {
        throw new BadRequestException('A file is required for this content type');
      }
      return this.queueFileMaterial(userId, dto, fileBuffer, originalFilename);
    }

    throw new BadRequestException('Unsupported content type');
  }

  private async uploadTextMaterial(userId: string, dto: UploadMaterialDto) {
    if (!dto.textContent)
      throw new BadRequestException('textContent is required for TEXT type');
    if (dto.textContent.length > MAX_TEXT_LENGTH) {
      throw new BadRequestException(
        `Text content exceeds maximum length of ${MAX_TEXT_LENGTH} characters`,
      );
    }

    const material = await this.prisma.sourceMaterial.create({
      data: {
        userId,
        certificationId: dto.certificationId || null,
        title: dto.title,
        contentType: dto.contentType,
        status: 'processing',
      },
    });

    const chunks = chunkText(dto.textContent);
    await this.prisma.sourceChunk.createMany({
      data: chunks.map((c) => ({
        materialId: material.id,
        content: c.content,
        chunkIndex: c.chunkIndex,
        pageNumber: c.pageNumber ?? null,
        sectionTitle: c.sectionTitle ?? null,
        tokenCount: c.tokenCount,
      })),
    });

    return this.prisma.sourceMaterial.update({
      where: { id: material.id },
      data: { chunkCount: chunks.length, status: 'ready' },
      include: { _count: { select: { chunks: true } } },
    });
  }

  private async uploadUrlMaterial(userId: string, dto: UploadMaterialDto) {
    if (!dto.sourceUrl)
      throw new BadRequestException('sourceUrl is required for URL type');

    const rawText = await this.fetchUrl(dto.sourceUrl);

    const material = await this.prisma.sourceMaterial.create({
      data: {
        userId,
        certificationId: dto.certificationId || null,
        title: dto.title,
        contentType: dto.contentType,
        sourceUrl: dto.sourceUrl,
        status: 'processing',
      },
    });

    const chunks = chunkText(rawText);
    await this.prisma.sourceChunk.createMany({
      data: chunks.map((c) => ({
        materialId: material.id,
        content: c.content,
        chunkIndex: c.chunkIndex,
        pageNumber: c.pageNumber ?? null,
        sectionTitle: c.sectionTitle ?? null,
        tokenCount: c.tokenCount,
      })),
    });

    return this.prisma.sourceMaterial.update({
      where: { id: material.id },
      data: { chunkCount: chunks.length, status: 'ready' },
      include: { _count: { select: { chunks: true } } },
    });
  }

  private async queueFileMaterial(
    userId: string,
    dto: UploadMaterialDto,
    fileBuffer: Buffer,
    originalFilename: string,
  ) {
    // Create the record first so we have a materialId for the job.
    const material = await this.prisma.sourceMaterial.create({
      data: {
        userId,
        certificationId: dto.certificationId || null,
        title: dto.title,
        contentType: dto.contentType,
        originalFilename,
        status: 'processing',
      },
      include: { _count: { select: { chunks: true } } },
    });

    // If staging or queueing fails, mark the material as failed so it doesn't
    // stay stuck in 'processing' forever (Fix #1).
    try {
      const jobData: MaterialConversionJobData = {
        materialId: material.id,
        filename: originalFilename,
      };

      const useS3 = !!process.env.AWS_S3_MATERIALS_TMP_BUCKET;
      if (useS3) {
        const { bucket, key } = await this.s3Upload.uploadToTemp(
          fileBuffer,
          originalFilename,
        );
        jobData.s3Bucket = bucket;
        jobData.s3Key = key;
      } else {
        // Local dev: embed buffer in job payload (Fix #4 — warn on large files).
        if (fileBuffer.length > LOCAL_BUFFER_WARN_BYTES) {
          this.logger.warn(
            `Large file embedded in Redis job payload (${Math.round(fileBuffer.length / 1024 / 1024)}MB). ` +
              'Set AWS_S3_MATERIALS_TMP_BUCKET to use S3 staging instead.',
          );
        }
        jobData.bufferBase64 = fileBuffer.toString('base64');
      }

      await this.conversionQueue.add('convert', jobData);
    } catch (err) {
      this.logger.error(
        `Failed to stage/queue material ${material.id}: ${err}`,
      );
      await this.prisma.sourceMaterial.update({
        where: { id: material.id },
        data: { status: 'failed' },
      });
      throw err;
    }

    return material;
  }

  async getMaterials(userId: string, certificationId?: string) {
    return this.prisma.sourceMaterial.findMany({
      where: {
        userId,
        ...(certificationId ? { certificationId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { chunks: true } } },
    });
  }

  async getMaterial(userId: string, materialId: string) {
    const material = await this.prisma.sourceMaterial.findUnique({
      where: { id: materialId },
      include: { _count: { select: { chunks: true } } },
    });
    if (!material) throw new NotFoundException('Material not found');
    if (material.userId !== userId) throw new ForbiddenException();
    return material;
  }

  async deleteMaterial(userId: string, materialId: string) {
    const material = await this.prisma.sourceMaterial.findUnique({
      where: { id: materialId },
    });
    if (!material) throw new NotFoundException('Material not found');
    if (material.userId !== userId) throw new ForbiddenException();
    await this.prisma.sourceMaterial.delete({ where: { id: materialId } });
  }

  async getChunksForMaterial(materialId: string): Promise<string[]> {
    const chunks = await this.prisma.sourceChunk.findMany({
      where: { materialId },
      orderBy: { chunkIndex: 'asc' },
      select: { content: true },
    });
    return chunks.map((c: { content: string }) => c.content);
  }

  private async fetchUrl(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BrainGym/1.0 (study material fetcher)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new BadRequestException(
        `Failed to fetch URL: ${response.statusText}`,
      );
    const html = await response.text();
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}
