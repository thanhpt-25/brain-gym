import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pbkdf2, randomBytes } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

const RATE_LIMIT = 100;
const RATE_WINDOW_SECONDS = 3600;

@Injectable()
export class McpKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private async hashKey(raw: string): Promise<string> {
    const secret =
      this.config.get<string>('MCP_KEY_HMAC_SECRET') ??
      'dev-fallback-change-in-production';
    const buf = await pbkdf2Async(raw, secret, 10000, 32, 'sha256');
    return buf.toString('hex');
  }

  async generateKey(userId: string, name: string) {
    const raw = 'mcp_' + randomBytes(32).toString('base64url');
    const prefix = raw.slice(0, 12);
    const keyHash = await this.hashKey(raw);

    const key = await this.prisma.mcpApiKey.create({
      data: { userId, name, keyHash, prefix },
      select: { id: true, prefix: true, name: true, createdAt: true },
    });

    return { ...key, plaintext: raw };
  }

  async listKeys(userId: string) {
    return this.prisma.mcpApiKey.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeKey(userId: string, keyId: string) {
    const key = await this.prisma.mcpApiKey.findUnique({
      where: { id: keyId },
    });
    if (!key) throw new NotFoundException('API key not found');
    if (key.userId !== userId) throw new ForbiddenException('Access denied');
    await this.prisma.mcpApiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
  }

  async findByRawKey(raw: string) {
    const hash = await this.hashKey(raw);
    return this.prisma.mcpApiKey.findFirst({
      where: { keyHash: hash, revokedAt: null },
      select: {
        id: true,
        userId: true,
        user: {
          select: { id: true, email: true, role: true, displayName: true },
        },
      },
    });
  }

  async checkRateLimit(keyId: string) {
    const redisKey = `mcprl:${keyId}`;
    const pipeline = this.redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.expire(redisKey, RATE_WINDOW_SECONDS, 'NX');
    const results = await pipeline.exec();
    const count = results?.[0]?.[1] as number;
    if (count > RATE_LIMIT) {
      throw new HttpException(
        'Rate limit exceeded: 100 requests per hour per API key',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  updateLastUsed(keyId: string) {
    this.prisma.mcpApiKey
      .update({ where: { id: keyId }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }
}
