# MCP API Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace long-lived JWT auth on the MCP intake endpoint with revocable scoped API keys, add per-key rate limiting, audit logging, and a Settings UI for key management.

**Architecture:** A new `McpKeysModule` provides `McpKeysService` (generate/list/revoke) and `ApiKeyAuthGuard` (SHA-256 hash lookup, sets `req.user` + `req.mcpKeyId`). The intake endpoint is marked `@Public()` (skips the global JWT guard) and uses `ApiKeyAuthGuard` instead. Rate limiting is enforced in the service via a Redis INCR counter keyed on `mcpKeyId`. The frontend adds an "MCP API Keys" tab to the Profile page.

**Tech Stack:** NestJS 11, Prisma (PostgreSQL), ioredis, React 18 + TanStack Query, shadcn/ui, Zod.

## Global Constraints

- Backend: NestJS 11, Prisma ORM, TypeScript strict-ish (`noImplicitAny: false`, `strictNullChecks: false`)
- Frontend: React 18, TypeScript, TanStack Query for all server state, shadcn/ui components, Zod for validation
- All new backend files follow `kebab-case.service.ts` / `kebab-case.controller.ts` naming
- Prisma model fields use `@map("snake_case")` convention; model names are PascalCase
- No new npm packages — use existing `ioredis`, `crypto` (Node built-in), `class-validator`, `@nestjs/common`
- Run `cd backend && npm run test` after each backend task to confirm no regressions
- Run `npm run lint` in root after each frontend task

---

## File Map

**Created:**
- `backend/src/mcp-keys/mcp-keys.service.ts` — generate/list/revoke logic + rate-limit check
- `backend/src/mcp-keys/mcp-keys.service.spec.ts` — unit tests
- `backend/src/mcp-keys/api-key-auth.guard.ts` — validates X-API-Key header
- `backend/src/mcp-keys/api-key-auth.guard.spec.ts` — unit tests
- `backend/src/mcp-keys/mcp-keys.controller.ts` — REST endpoints
- `backend/src/mcp-keys/mcp-keys.module.ts` — module wiring

**Modified:**
- `backend/prisma/schema.prisma` — add `McpApiKey` model + User relation
- `backend/src/app.module.ts` — import `McpKeysModule`
- `backend/src/ai-question-bank/ai-question-bank.controller.ts` — @Public + ApiKeyAuthGuard on mcpIntake
- `backend/src/ai-question-bank/ai-question-bank.service.ts` — add rate limit + audit log to mcpIntake
- `backend/src/ai-question-bank/ai-question-bank.module.ts` — import McpKeysModule + RedisModule
- `backend/src/mcp-server.ts` — swap BRAIN_GYM_BEARER_TOKEN → BRAIN_GYM_API_KEY
- `src/services/mcp-keys.ts` — new frontend service (API calls)
- `src/types/api-types.ts` — add McpApiKey types
- `src/components/profile/McpApiKeysTab.tsx` — new component
- `src/pages/Profile.tsx` — add "MCP Keys" tab

---

## Task 1: Prisma Schema — McpApiKey Model

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `McpApiKey` Prisma model available in `@prisma/client`

- [ ] **Step 1: Add McpApiKey model to schema.prisma**

Open `backend/prisma/schema.prisma`. After the `UserLlmConfig` model (around line 712), add:

```prisma
model McpApiKey {
  id         String    @id @default(uuid())
  userId     String    @map("user_id")
  name       String
  keyHash    String    @unique @map("key_hash")
  prefix     String
  lastUsedAt DateTime? @map("last_used_at")
  createdAt  DateTime  @default(now()) @map("created_at")
  revokedAt  DateTime? @map("revoked_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("mcp_api_keys")
}
```

- [ ] **Step 2: Add relation to User model**

In the `User` model (around line 234), add after the `llmConfigs` line:

```prisma
  mcpApiKeys                 McpApiKey[]
```

- [ ] **Step 3: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_mcp_api_keys
```

Expected output: `The following migration(s) have been created and applied: migrations/YYYYMMDD_add_mcp_api_keys`

- [ ] **Step 4: Verify Prisma client regenerated**

```bash
cd backend && npx prisma generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add McpApiKey prisma model and migration"
```

---

## Task 2: McpKeysService — Generate, List, Revoke, Rate-Limit

**Files:**
- Create: `backend/src/mcp-keys/mcp-keys.service.ts`
- Create: `backend/src/mcp-keys/mcp-keys.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (injected), `REDIS_CLIENT` (ioredis, injected via token)
- Produces:
  - `generateKey(userId: string, name: string): Promise<{ id: string; prefix: string; name: string; createdAt: Date; plaintext: string }>`
  - `listKeys(userId: string): Promise<Array<{ id: string; name: string; prefix: string; createdAt: Date; lastUsedAt: Date | null }>>`
  - `revokeKey(userId: string, keyId: string): Promise<void>`
  - `findByHash(hash: string): Promise<{ id: string; userId: string; user: { id: string; email: string; role: string; displayName: string } } | null>`
  - `checkRateLimit(keyId: string): Promise<void>` — throws `HttpException(429)` if > 100 req/hr

- [ ] **Step 1: Write the failing tests**

Create `backend/src/mcp-keys/mcp-keys.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, NotFoundException, ForbiddenException } from '@nestjs/common';
import { McpKeysService } from './mcp-keys.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

const mockPrisma = {
  mcpApiKey: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
};

describe('McpKeysService', () => {
  let service: McpKeysService;
  let prisma: typeof mockPrisma;
  let redis: typeof mockRedis;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpKeysService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<McpKeysService>(McpKeysService);
    prisma = module.get<PrismaService>(PrismaService) as any;
    redis = module.get(REDIS_CLIENT);
  });

  afterEach(() => jest.clearAllMocks());

  describe('generateKey', () => {
    it('should return plaintext key with mcp_ prefix and store hash', async () => {
      const fakeKey = { id: 'key-1', prefix: 'mcp_abcd', name: 'My Key', createdAt: new Date() };
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
      const keys = [{ id: 'k1', name: 'Key 1', prefix: 'mcp_abcd', createdAt: new Date(), lastUsedAt: null }];
      prisma.mcpApiKey.findMany.mockResolvedValue(keys);

      const result = await service.listKeys('user-1');

      expect(prisma.mcpApiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', revokedAt: null } }),
      );
      expect(result).toEqual(keys);
    });
  });

  describe('revokeKey', () => {
    it('should set revokedAt on owned key', async () => {
      prisma.mcpApiKey.findUnique.mockResolvedValue({ id: 'k1', userId: 'user-1' });
      prisma.mcpApiKey.update.mockResolvedValue({});

      await service.revokeKey('user-1', 'k1');

      expect(prisma.mcpApiKey.update).toHaveBeenCalledWith({
        where: { id: 'k1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException if key does not exist', async () => {
      prisma.mcpApiKey.findUnique.mockResolvedValue(null);
      await expect(service.revokeKey('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if key belongs to another user', async () => {
      prisma.mcpApiKey.findUnique.mockResolvedValue({ id: 'k1', userId: 'user-2' });
      await expect(service.revokeKey('user-1', 'k1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByHash', () => {
    it('should return key with user for a valid active hash', async () => {
      const key = { id: 'k1', userId: 'u1', user: { id: 'u1', email: 'x@x.com', role: 'CONTRIBUTOR', displayName: 'X' } };
      prisma.mcpApiKey.findUnique.mockResolvedValue(key);

      const result = await service.findByHash('somehash');
      expect(result).toEqual(key);
    });

    it('should return null if not found', async () => {
      prisma.mcpApiKey.findUnique.mockResolvedValue(null);
      const result = await service.findByHash('badhash');
      expect(result).toBeNull();
    });
  });

  describe('checkRateLimit', () => {
    it('should not throw when under limit', async () => {
      redis.incr.mockResolvedValue(50);
      redis.expire.mockResolvedValue(1);
      await expect(service.checkRateLimit('key-1')).resolves.not.toThrow();
    });

    it('should throw 429 when over limit', async () => {
      redis.incr.mockResolvedValue(101);
      redis.expire.mockResolvedValue(1);
      await expect(service.checkRateLimit('key-1')).rejects.toThrow(
        new HttpException('Rate limit exceeded: 100 requests per hour per API key', HttpStatus.TOO_MANY_REQUESTS),
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest mcp-keys.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './mcp-keys.service'`

- [ ] **Step 3: Implement McpKeysService**

Create `backend/src/mcp-keys/mcp-keys.service.ts`:

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

const RATE_LIMIT = 100;
const RATE_WINDOW_SECONDS = 3600;

@Injectable()
export class McpKeysService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async generateKey(userId: string, name: string) {
    const raw = 'mcp_' + randomBytes(32).toString('base64url');
    const prefix = raw.slice(0, 12);
    const keyHash = createHash('sha256').update(raw).digest('hex');

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

  async findByHash(hash: string) {
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
```

- [ ] **Step 4: Run tests — should pass**

```bash
cd backend && npx jest mcp-keys.service.spec.ts --no-coverage
```

Expected: PASS (all 7 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/mcp-keys/mcp-keys.service.ts backend/src/mcp-keys/mcp-keys.service.spec.ts
git commit -m "feat: add McpKeysService with generate, list, revoke, and rate-limit"
```

---

## Task 3: ApiKeyAuthGuard

**Files:**
- Create: `backend/src/mcp-keys/api-key-auth.guard.ts`
- Create: `backend/src/mcp-keys/api-key-auth.guard.spec.ts`

**Interfaces:**
- Consumes: `McpKeysService.findByHash()`, `McpKeysService.updateLastUsed()`
- Produces: Sets `req.user: AuthenticatedUser` and `req.mcpKeyId: string` on the Express request; throws `UnauthorizedException` on failure

- [ ] **Step 1: Write the failing tests**

Create `backend/src/mcp-keys/api-key-auth.guard.spec.ts`:

```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { McpKeysService } from './mcp-keys.service';

const mockMcpKeysService = {
  findByHash: jest.fn(),
  updateLastUsed: jest.fn(),
};

function makeContext(headers: Record<string, string> = {}) {
  const req: any = { headers, mcpKeyId: undefined, user: undefined };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyAuthGuard', () => {
  let guard: ApiKeyAuthGuard;

  beforeEach(() => {
    guard = new ApiKeyAuthGuard(mockMcpKeysService as unknown as McpKeysService);
    jest.clearAllMocks();
  });

  it('should throw UnauthorizedException when X-API-Key header is missing', async () => {
    await expect(guard.canActivate(makeContext())).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for malformed key (no mcp_ prefix)', async () => {
    await expect(guard.canActivate(makeContext({ 'x-api-key': 'badkey' }))).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when key hash not found in DB', async () => {
    mockMcpKeysService.findByHash.mockResolvedValue(null);
    await expect(guard.canActivate(makeContext({ 'x-api-key': 'mcp_validlooking12345678901234567890123456' }))).rejects.toThrow(UnauthorizedException);
  });

  it('should set req.user and req.mcpKeyId and return true for valid key', async () => {
    const fakeKey = {
      id: 'key-1',
      userId: 'user-1',
      user: { id: 'user-1', email: 'x@x.com', role: 'CONTRIBUTOR', displayName: 'X' },
    };
    mockMcpKeysService.findByHash.mockResolvedValue(fakeKey);

    const ctx = makeContext({ 'x-api-key': 'mcp_validlooking12345678901234567890123456' });
    const req = ctx.switchToHttp().getRequest();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.user).toEqual({ id: 'user-1', email: 'x@x.com', role: 'CONTRIBUTOR', displayName: 'X' });
    expect(req.mcpKeyId).toBe('key-1');
    expect(mockMcpKeysService.updateLastUsed).toHaveBeenCalledWith('key-1');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest api-key-auth.guard.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './api-key-auth.guard'`

- [ ] **Step 3: Implement ApiKeyAuthGuard**

Create `backend/src/mcp-keys/api-key-auth.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { McpKeysService } from './mcp-keys.service';

const MCP_KEY_PREFIX = 'mcp_';
const MIN_KEY_LENGTH = 20;

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly mcpKeys: McpKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const raw: string | undefined = req.headers['x-api-key'];

    if (!raw) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    if (!raw.startsWith(MCP_KEY_PREFIX) || raw.length < MIN_KEY_LENGTH) {
      throw new UnauthorizedException('Invalid API key');
    }

    const hash = createHash('sha256').update(raw).digest('hex');
    const key = await this.mcpKeys.findByHash(hash);

    if (!key) {
      throw new UnauthorizedException('Invalid API key');
    }

    req.user = key.user;
    req.mcpKeyId = key.id;
    this.mcpKeys.updateLastUsed(key.id);

    return true;
  }
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
cd backend && npx jest api-key-auth.guard.spec.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/mcp-keys/api-key-auth.guard.ts backend/src/mcp-keys/api-key-auth.guard.spec.ts
git commit -m "feat: add ApiKeyAuthGuard for X-API-Key header validation"
```

---

## Task 4: McpKeysController + McpKeysModule

**Files:**
- Create: `backend/src/mcp-keys/mcp-keys.controller.ts`
- Create: `backend/src/mcp-keys/mcp-keys.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `McpKeysService.generateKey()`, `McpKeysService.listKeys()`, `McpKeysService.revokeKey()`
- Produces:
  - `GET /api/v1/mcp-keys` → `Array<{ id, name, prefix, createdAt, lastUsedAt }>`
  - `POST /api/v1/mcp-keys` body `{ name: string }` → `{ id, prefix, name, createdAt, plaintext }`
  - `DELETE /api/v1/mcp-keys/:id` → `204 No Content`

- [ ] **Step 1: Create McpKeysController**

Create `backend/src/mcp-keys/mcp-keys.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/request.interface';
import { McpKeysService } from './mcp-keys.service';

class CreateMcpKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;
}

@ApiTags('MCP API Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mcp-keys')
export class McpKeysController {
  constructor(private readonly service: McpKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List active MCP API keys for the current user' })
  list(@Req() req: AuthenticatedRequest) {
    return this.service.listKeys(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Generate a new MCP API key (plaintext returned once)' })
  generate(@Req() req: AuthenticatedRequest, @Body() dto: CreateMcpKeyDto) {
    return this.service.generateKey(req.user.id, dto.name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an MCP API key' })
  revoke(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.revokeKey(req.user.id, id);
  }
}
```

- [ ] **Step 2: Create McpKeysModule**

Create `backend/src/mcp-keys/mcp-keys.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { McpKeysService } from './mcp-keys.service';
import { McpKeysController } from './mcp-keys.controller';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [McpKeysController],
  providers: [McpKeysService, ApiKeyAuthGuard],
  exports: [McpKeysService, ApiKeyAuthGuard],
})
export class McpKeysModule {}
```

- [ ] **Step 3: Register McpKeysModule in AppModule**

Open `backend/src/app.module.ts`. Add the import at the top:

```typescript
import { McpKeysModule } from './mcp-keys/mcp-keys.module';
```

Add `McpKeysModule` to the `imports` array (after `CompetencyModule`):

```typescript
    CompetencyModule,
    McpKeysModule,
```

- [ ] **Step 4: Run tests to confirm no regressions**

```bash
cd backend && npm run test -- --passWithNoTests 2>&1 | tail -20
```

Expected: All previously passing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/mcp-keys/ backend/src/app.module.ts
git commit -m "feat: add McpKeysController and McpKeysModule"
```

---

## Task 5: Harden mcpIntake Endpoint

**Files:**
- Modify: `backend/src/ai-question-bank/ai-question-bank.controller.ts`
- Modify: `backend/src/ai-question-bank/ai-question-bank.service.ts`
- Modify: `backend/src/ai-question-bank/ai-question-bank.module.ts`

**Interfaces:**
- Consumes: `ApiKeyAuthGuard` from McpKeysModule; `McpKeysService.checkRateLimit(keyId)`; `AuditService.log()`
- The request now carries `req.mcpKeyId: string` (set by ApiKeyAuthGuard)

- [ ] **Step 1: Update the controller — @Public + ApiKeyAuthGuard**

Open `backend/src/ai-question-bank/ai-question-bank.controller.ts`.

Add import at top (with existing imports):

```typescript
import { Public } from '../common/decorators/public.decorator';
import { ApiKeyAuthGuard } from '../mcp-keys/api-key-auth.guard';
```

Add a `McpRequest` interface after the imports (extends the existing `AuthenticatedRequest`):

```typescript
interface McpRequest extends AuthenticatedRequest {
  mcpKeyId: string;
}
```

Replace the existing `mcpIntake` method:

```typescript
  @Post('mcp/intake')
  @Public()
  @UseGuards(ApiKeyAuthGuard)
  @ApiOperation({
    summary:
      'MCP mode: receive questions pushed from external AI tools (Claude Desktop, etc.)',
  })
  mcpIntake(@Req() req: McpRequest, @Body() dto: McpIntakeDto) {
    return this.service.mcpIntake(req.user.id, req.mcpKeyId, dto);
  }
```

The existing `import type { AuthenticatedRequest } from '../common/interfaces/request.interface'` is already present in the file — no change needed to that import line.

- [ ] **Step 2: Update AiQuestionBankModule to import McpKeysModule**

Open `backend/src/ai-question-bank/ai-question-bank.module.ts`. Add imports:

```typescript
import { McpKeysModule } from '../mcp-keys/mcp-keys.module';
import { RedisModule } from '../redis/redis.module';
```

Add both to the `imports` array:

```typescript
  imports: [
    PrismaModule,
    QuestionsModule,
    LlmUsageModule,
    EmbeddingModule,
    DdsModule,
    McpKeysModule,
    RedisModule,
    MulterModule.register({ limits: { fileSize: 50 * 1024 * 1024 } }),
    BullModule.registerQueue({ name: AI_GEN_QUEUE }),
    BullModule.registerQueue({ name: MATERIAL_CONVERSION_QUEUE }),
  ],
```

Also add `ApiKeyAuthGuard` to the `providers` array:

```typescript
  providers: [AiQuestionBankService, EncryptionService, IngestionService, S3UploadService, ApiKeyAuthGuard],
```

And add the import:

```typescript
import { ApiKeyAuthGuard } from '../mcp-keys/api-key-auth.guard';
```

- [ ] **Step 3: Update AiQuestionBankService.mcpIntake — add rate limit + audit**

Open `backend/src/ai-question-bank/ai-question-bank.service.ts`.

Add `AuditService` to the imports and constructor. Add `McpKeysService` import:

```typescript
import { AuditService } from '../audit/audit.service';
import { McpKeysService } from '../mcp-keys/mcp-keys.service';
```

Add to constructor parameters:

```typescript
    private readonly audit: AuditService,
    private readonly mcpKeys: McpKeysService,
```

Replace the existing `mcpIntake` method signature and body:

```typescript
  async mcpIntake(userId: string, keyId: string, dto: McpIntakeDto) {
    await this.mcpKeys.checkRateLimit(keyId);

    const saved: string[] = [];
    const discarded: number[] = [];

    for (const [index, q] of dto.questions.entries()) {
      const score = q.quality_score ?? 0.7;
      const tier = this.scoreTotier(score);

      if (tier === null) {
        discarded.push(index);
        continue;
      }

      const status =
        tier === QualityTier.HIGH
          ? QuestionStatus.APPROVED
          : QuestionStatus.PENDING;
      const qType = dto.questionType || QuestionType.SINGLE;

      const question = await this.questions.create(
        userId,
        {
          title: q.question,
          explanation: q.explanation,
          questionType: qType,
          difficulty: dto.difficulty || Difficulty.MEDIUM,
          certificationId: dto.certificationId,
          domainId: dto.domainId,
          choices: q.choices,
        },
        status,
        undefined,
        tier,
      );

      saved.push(question.id);
    }

    this.audit
      .log({
        userId,
        action: 'MCP_INTAKE',
        targetType: 'certification',
        targetId: dto.certificationId,
        metadata: {
          keyId,
          source: dto.source ?? 'MCP',
          saved: saved.length,
          discarded: discarded.length,
        },
      })
      .catch(() => {});

    return {
      saved: saved.length,
      discarded: discarded.length,
      questionIds: saved,
    };
  }
```

- [ ] **Step 4: Run all backend tests**

```bash
cd backend && npm run test -- --passWithNoTests 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai-question-bank/
git commit -m "feat: harden mcpIntake with ApiKeyAuthGuard, rate limiting, and audit log"
```

---

## Task 6: Update mcp-server.ts

**Files:**
- Modify: `backend/src/mcp-server.ts`

**Interfaces:**
- Consumes: env var `BRAIN_GYM_API_KEY` (renamed from `BRAIN_GYM_BEARER_TOKEN`)
- Produces: requests to `/api/v1/ai-questions/mcp/intake` with `X-API-Key` header instead of `Authorization: Bearer`

- [ ] **Step 1: Update env var name and header**

Open `backend/src/mcp-server.ts`. Make the following changes:

1. Replace the file-header comment env var doc:

```
 *   BRAIN_GYM_API_KEY       – MCP API key generated in CertGym Settings (required, starts with mcp_)
```

2. Replace in the claude_desktop_config.json example in the comment:

```
 *           "BRAIN_GYM_API_KEY": "<your-mcp-api-key-from-settings>"
```

3. Replace the variable declaration:

```typescript
const BEARER_TOKEN = process.env.BRAIN_GYM_BEARER_TOKEN || '';
```
→
```typescript
const API_KEY = process.env.BRAIN_GYM_API_KEY || '';
```

4. Replace the guard check:

```typescript
if (!BEARER_TOKEN) {
  console.error(
    '[brain-gym-mcp] ERROR: BRAIN_GYM_BEARER_TOKEN environment variable is required.\n' +
      'Set it to a valid JWT token from your Brain Gym account.',
  );
  process.exit(1);
}
```
→
```typescript
if (!API_KEY || !API_KEY.startsWith('mcp_')) {
  console.error(
    '[brain-gym-mcp] ERROR: BRAIN_GYM_API_KEY environment variable is required.\n' +
      'Generate one in CertGym Settings → MCP API Keys. It starts with "mcp_".',
  );
  process.exit(1);
}
```

5. Replace the header in `callIntakeApi`:

```typescript
      Authorization: `Bearer ${BEARER_TOKEN}`,
```
→
```typescript
      'X-API-Key': API_KEY,
```

- [ ] **Step 2: Build check**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to mcp-server.ts.

- [ ] **Step 3: Commit**

```bash
git add backend/src/mcp-server.ts
git commit -m "feat: update mcp-server.ts to use BRAIN_GYM_API_KEY and X-API-Key header"
```

---

## Task 7: Frontend — Types + Service

**Files:**
- Modify: `src/types/api-types.ts`
- Create: `src/services/mcp-keys.ts`

**Interfaces:**
- Produces:
  - `McpApiKey` type
  - `McpApiKeyCreated` type (includes `plaintext`)
  - `listMcpKeys(): Promise<McpApiKey[]>`
  - `generateMcpKey(name: string): Promise<McpApiKeyCreated>`
  - `revokeMcpKey(id: string): Promise<void>`

- [ ] **Step 1: Add types to api-types.ts**

Open `src/types/api-types.ts`. Add at the end:

```typescript
export interface McpApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface McpApiKeyCreated extends McpApiKey {
  plaintext: string;
}
```

- [ ] **Step 2: Create the frontend service**

Create `src/services/mcp-keys.ts`:

```typescript
import api from "./api";
import { McpApiKey, McpApiKeyCreated } from "../types/api-types";

export const listMcpKeys = async (): Promise<McpApiKey[]> => {
  const res = await api.get<McpApiKey[]>("/mcp-keys");
  return res.data;
};

export const generateMcpKey = async (name: string): Promise<McpApiKeyCreated> => {
  const res = await api.post<McpApiKeyCreated>("/mcp-keys", { name });
  return res.data;
};

export const revokeMcpKey = async (id: string): Promise<void> => {
  await api.delete(`/mcp-keys/${id}`);
};
```

- [ ] **Step 3: Lint check**

```bash
npm run lint -- src/services/mcp-keys.ts src/types/api-types.ts
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/mcp-keys.ts src/types/api-types.ts
git commit -m "feat: add MCP API key frontend types and service"
```

---

## Task 8: Frontend — McpApiKeysTab Component

**Files:**
- Create: `src/components/profile/McpApiKeysTab.tsx`

**Interfaces:**
- Consumes: `listMcpKeys`, `generateMcpKey`, `revokeMcpKey` from `src/services/mcp-keys.ts`; `McpApiKey`, `McpApiKeyCreated` from `src/types/api-types.ts`
- Produces: `<McpApiKeysTab />` — a React component with no props

- [ ] **Step 1: Create the component**

Create `src/components/profile/McpApiKeysTab.tsx`:

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { listMcpKeys, generateMcpKey, revokeMcpKey } from "@/services/mcp-keys";
import { McpApiKeyCreated } from "@/types/api-types";

export default function McpApiKeysTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showGenerate, setShowGenerate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<McpApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["mcp-keys"],
    queryFn: listMcpKeys,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateMcpKey(newKeyName.trim()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["mcp-keys"] });
      setCreatedKey(data);
      setNewKeyName("");
    },
    onError: () => {
      toast({ title: "Failed to generate key", variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeMcpKey,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mcp-keys"] });
      toast({ title: "API key revoked" });
    },
    onError: () => {
      toast({ title: "Failed to revoke key", variant: "destructive" });
    },
  });

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey.plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseCreated = () => {
    setCreatedKey(null);
    setShowGenerate(false);
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString() : "Never";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">MCP API Keys</h3>
          <p className="text-sm text-muted-foreground">
            Use these keys to let Claude Desktop or any MCP-compatible tool push questions into your account.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowGenerate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Generate key
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : keys.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Key className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No API keys yet. Generate one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <Card key={key.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <p className="font-medium text-sm">{key.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{key.prefix}…</p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDate(key.createdAt)} · Last used {formatDate(key.lastUsedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(key.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generate key dialog */}
      <Dialog open={showGenerate && !createdKey} onOpenChange={(o) => { if (!o) setShowGenerate(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate MCP API Key</DialogTitle>
            <DialogDescription>
              Give this key a name so you can identify it later (e.g. "My Claude Desktop").
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="key-name">Key name</Label>
            <Input
              id="key-name"
              placeholder="My Claude Desktop"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newKeyName.trim()) generateMutation.mutate(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button
              disabled={!newKeyName.trim() || generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show created key dialog */}
      <Dialog open={!!createdKey} onOpenChange={(o) => { if (!o) handleCloseCreated(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription className="text-destructive font-medium">
              This key will not be shown again. Copy it now.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Your new API key</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={createdKey?.plaintext ?? ""}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste this into your Claude Desktop config as <code>BRAIN_GYM_API_KEY</code>.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleCloseCreated}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Lint check**

```bash
npm run lint -- src/components/profile/McpApiKeysTab.tsx
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/McpApiKeysTab.tsx
git commit -m "feat: add McpApiKeysTab component for key management UI"
```

---

## Task 9: Wire McpApiKeysTab into Profile Page

**Files:**
- Modify: `src/pages/Profile.tsx`

**Interfaces:**
- Consumes: `McpApiKeysTab` from `src/components/profile/McpApiKeysTab.tsx`
- Produces: A new "MCP Keys" tab in the existing `<Tabs>` on the Profile page

- [ ] **Step 1: Import the component**

Open `src/pages/Profile.tsx`. Add the import after the existing imports:

```tsx
import McpApiKeysTab from "@/components/profile/McpApiKeysTab";
```

- [ ] **Step 2: Add the tab trigger**

Find the `<TabsList>` in the Profile page JSX. It contains triggers like `<TabsTrigger value="profile">`, `<TabsTrigger value="security">`, etc. Add a new trigger:

```tsx
<TabsTrigger value="mcp-keys">MCP Keys</TabsTrigger>
```

- [ ] **Step 3: Add the tab content**

Find the last `</TabsContent>` before `</Tabs>`. Add after it:

```tsx
<TabsContent value="mcp-keys">
  <McpApiKeysTab />
</TabsContent>
```

- [ ] **Step 4: Lint check**

```bash
npm run lint -- src/pages/Profile.tsx
```

Expected: No errors.

- [ ] **Step 5: Run all frontend tests**

```bash
npm run test -- --passWithNoTests 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat: add MCP Keys tab to Profile settings page"
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] `POST /api/v1/mcp-keys` returns `plaintext` — verify with: `curl -X POST http://localhost:3000/api/v1/mcp-keys -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" -d '{"name":"Test"}'`
- [ ] `POST /api/v1/ai-questions/mcp/intake` with a valid `X-API-Key` returns 200 and saves questions
- [ ] Same endpoint with no header or invalid key returns 401
- [ ] 101st request within an hour returns 429
- [ ] Revoked key returns 401 on the intake endpoint
- [ ] Audit log entry exists in DB after a successful intake call
- [ ] Profile page shows "MCP Keys" tab with generate/revoke flow
