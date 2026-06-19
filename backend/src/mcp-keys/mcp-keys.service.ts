import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pbkdf2Sync, randomBytes } from 'crypto';
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

  private hashKey(raw: string): string {
    const secret = this.config.get<string>('MCP_KEY_HMAC_SECRET') ?? 'dev-fallback-change-in-production';
    return pbkdf2Sync(raw, secret, 10000, 32, 'sha256').toString('hex');
  }

  async generateKey(userId: string, name: string) {
    const raw = 'mcp_' + randomBytes(32).toString('base64url');
    const prefix = raw.slice(0, 12);
    const keyHash = this.hashKey(raw);

    const key = await this.prisma.mcpApiKey.create({
      data: { userId, name, keyHash, prefix },
      select: { id: true, prefix: true, name: true, createdAt: true },
    });

    return { ...key, plaintext: raw };
  }

  async listKeys(userId: string) {
    return this.prisma.mcpApiKey.findMany({
      where: { userId, revokedAt: null },
      select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeKey(userId: string, keyId: string) {
    const key = await this.prisma.mcpApiKey.findUnique({ where: { id: keyId } });
    if (!key) throw new NotFoundException('API key not found');
    if (key.userId !== userId) throw new ForbiddenException('Access denied');
    await this.prisma.mcpApiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
  }

  async findByRawKey(raw: string) {
    const hash = this.hashKey(raw);
    const key = await this.prisma.mcpApiKey.findFirst({
      where: { keyHash: hash, revokedAt: null },
      select: {
        id: true,
        userId: true,
        revokedAt: true,
        user: { select: { id: true, email: true, role: true, displayName: true } },
      },
    });
    if (!key || key.revokedAt) return null;
    const { revokedAt: _, ...rest } = key;
    return rest;
  }

  async checkRateLimit(keyId: string) {
    const redisKey = `mcprl:${keyId}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, RATE_WINDOW_SECONDS);
    }
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
