import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpKeysService } from './mcp-keys.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

const mockPrisma = {
  mcpApiKey: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockPipeline = {
  incr: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  exec: jest.fn(),
};

const mockRedis = {
  pipeline: jest.fn(() => mockPipeline),
};

const mockConfig = { get: jest.fn().mockReturnValue('test-hmac-secret') };

describe('McpKeysService', () => {
  let service: McpKeysService;
  let prisma: typeof mockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpKeysService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<McpKeysService>(McpKeysService);
    prisma = module.get<PrismaService>(PrismaService) as any;
  });

  afterEach(() => jest.clearAllMocks());

  describe('generateKey', () => {
    it('should return plaintext key with mcp_ prefix and store hash', async () => {
      const fakeKey = {
        id: 'key-1',
        prefix: 'mcp_abcd1234',
        name: 'My Key',
        createdAt: new Date(),
      };
      prisma.mcpApiKey.create.mockResolvedValue(fakeKey);

      const result = await service.generateKey('user-1', 'My Key');

      expect(result.plaintext).toMatch(/^mcp_/);
      expect(result.prefix).toMatch(/^mcp_/);
      expect(result.plaintext.length).toBeGreaterThan(40);
      expect(prisma.mcpApiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            name: 'My Key',
            keyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          }),
        }),
      );
    });
  });

  describe('listKeys', () => {
    it('should return active keys for user', async () => {
      const keys = [
        {
          id: 'k1',
          name: 'Key 1',
          prefix: 'mcp_abcd',
          createdAt: new Date(),
          lastUsedAt: null,
        },
      ];
      prisma.mcpApiKey.findMany.mockResolvedValue(keys);

      const result = await service.listKeys('user-1');

      expect(prisma.mcpApiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', revokedAt: null },
        }),
      );
      expect(result).toEqual(keys);
    });
  });

  describe('revokeKey', () => {
    it('should set revokedAt on owned key', async () => {
      prisma.mcpApiKey.findUnique.mockResolvedValue({
        id: 'k1',
        userId: 'user-1',
      });
      prisma.mcpApiKey.update.mockResolvedValue({});

      await service.revokeKey('user-1', 'k1');

      expect(prisma.mcpApiKey.update).toHaveBeenCalledWith({
        where: { id: 'k1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException if key does not exist', async () => {
      prisma.mcpApiKey.findUnique.mockResolvedValue(null);
      await expect(service.revokeKey('user-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if key belongs to another user', async () => {
      prisma.mcpApiKey.findUnique.mockResolvedValue({
        id: 'k1',
        userId: 'user-2',
      });
      await expect(service.revokeKey('user-1', 'k1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findByRawKey', () => {
    it('should return key with user for a valid active key', async () => {
      const key = {
        id: 'k1',
        userId: 'u1',
        user: {
          id: 'u1',
          email: 'x@x.com',
          role: 'CONTRIBUTOR',
          displayName: 'X',
        },
      };
      prisma.mcpApiKey.findFirst.mockResolvedValue(key);

      const result = await service.findByRawKey(
        'mcp_somevalidkey123456789012345678901234',
      );
      expect(result).toEqual(key);
    });

    it('should return null if not found', async () => {
      prisma.mcpApiKey.findFirst.mockResolvedValue(null);
      const result = await service.findByRawKey(
        'mcp_somevalidkey123456789012345678901234',
      );
      expect(result).toBeNull();
    });
  });

  describe('checkRateLimit', () => {
    it('should not throw when under limit', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 50],
        [null, 1],
      ]);
      await expect(service.checkRateLimit('key-1')).resolves.not.toThrow();
    });

    it('should throw 429 when over limit', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 101],
        [null, 1],
      ]);
      await expect(service.checkRateLimit('key-1')).rejects.toThrow(
        new HttpException(
          'Rate limit exceeded: 100 requests per hour per API key',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
    });
  });
});
