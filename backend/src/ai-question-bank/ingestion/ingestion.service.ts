import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MaterialContentType } from '@prisma/client';
import { UploadMaterialDto } from '../dto/upload-material.dto';
import { chunkText } from './chunker';
import { isIP } from 'node:net';

const MAX_TEXT_LENGTH = 100_000; // ~25k tokens

@Injectable()
export class IngestionService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadMaterial(
    userId: string,
    dto: UploadMaterialDto,
    fileBuffer?: Buffer,
  ) {
    let rawText: string;

    if (dto.contentType === MaterialContentType.TEXT) {
      if (!dto.textContent)
        throw new BadRequestException('textContent is required for TEXT type');
      if (dto.textContent.length > MAX_TEXT_LENGTH) {
        throw new BadRequestException(
          `Text content exceeds maximum length of ${MAX_TEXT_LENGTH} characters`,
        );
      }
      rawText = dto.textContent;
    } else if (dto.contentType === MaterialContentType.URL) {
      if (!dto.sourceUrl)
        throw new BadRequestException('sourceUrl is required for URL type');
      rawText = await this.fetchUrl(dto.sourceUrl);
    } else if (dto.contentType === MaterialContentType.PDF) {
      if (!fileBuffer)
        throw new BadRequestException('A PDF file is required for PDF type');
      rawText = await this.parsePdf(fileBuffer);
    } else {
      throw new BadRequestException('Unsupported content type');
    }

    // Create the SourceMaterial record
    const material = await this.prisma.sourceMaterial.create({
      data: {
        userId,
        certificationId: dto.certificationId || null,
        title: dto.title,
        contentType: dto.contentType,
        sourceUrl: dto.sourceUrl || null,
        status: 'processing',
      },
    });

    // Chunk and store
    const chunks = chunkText(rawText);
    await this.prisma.sourceChunk.createMany({
      data: chunks.map((c) => ({
        materialId: material.id,
        content: c.content,
        chunkIndex: c.chunkIndex,
        pageNumber: c.pageNumber || null,
        sectionTitle: c.sectionTitle || null,
        tokenCount: c.tokenCount,
      })),
    });

    // Update chunk count and status
    const updated = await this.prisma.sourceMaterial.update({
      where: { id: material.id },
      data: { chunkCount: chunks.length, status: 'ready' },
      include: { _count: { select: { chunks: true } } },
    });

    return updated;
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

  private isPrivateOrLocalIp(host: string): boolean {
    const ipVersion = isIP(host);
    if (!ipVersion) return false;

    if (ipVersion === 4) {
      const [a, b] = host.split('.').map((n) => Number(n));
      if (a === 10) return true; // 10.0.0.0/8
      if (a === 127) return true; // 127.0.0.0/8 (loopback)
      if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local)
      if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
      if (a === 192 && b === 168) return true; // 192.168.0.0/16
      if (a === 0) return true; // 0.0.0.0/8
      return false;
    }

    const normalized = host.toLowerCase();
    return (
      normalized === '::1' || // loopback
      normalized === '::' || // unspecified
      normalized.startsWith('fe80:') || // link-local
      normalized.startsWith('fc') || // unique local fc00::/7
      normalized.startsWith('fd') || // unique local fc00::/7
      normalized.startsWith('::ffff:') // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
    );
  }

  private validateAndNormalizeExternalUrl(rawUrl: string): string {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestException('Invalid sourceUrl');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Only HTTP/HTTPS URLs are allowed');
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname) {
      throw new BadRequestException('Invalid sourceUrl hostname');
    }

    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      throw new BadRequestException('URL hostname is not allowed');
    }

    if (this.isPrivateOrLocalIp(hostname)) {
      throw new BadRequestException(
        'Private or local network URLs are not allowed',
      );
    }

    return parsed.toString();
  }

  private async fetchUrl(url: string): Promise<string> {
    // validateAndNormalizeExternalUrl enforces: https/http only, no private/loopback
    // IPs (IPv4 + IPv4-mapped IPv6), no internal hostnames, and redirect:'error'
    // prevents redirect-chain bypass.
    const safeUrl = this.validateAndNormalizeExternalUrl(url);
    const response = await fetch(safeUrl, {
      headers: { 'User-Agent': 'BrainGym/1.0 (study material fetcher)' },
      signal: AbortSignal.timeout(15000),
      redirect: 'error', // prevent redirect chains bypassing SSRF validation
    });
    if (!response.ok)
      throw new BadRequestException(
        `Failed to fetch URL: ${response.statusText}`,
      );
    const html = await response.text();
    // Strip HTML tags
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private async parsePdf(buffer: Buffer): Promise<string> {
    // Dynamic import to avoid hard dependency at module load
    const pdfParse = await import('pdf-parse')
      .then((m) => m.default || m)
      .catch(() => null);
    if (!pdfParse) {
      throw new BadRequestException(
        'PDF parsing is not available. Please use TEXT type instead.',
      );
    }
    const data = await pdfParse(buffer);
    return data.text;
  }
}
