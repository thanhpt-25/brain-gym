import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/prisma/prisma.service';
import { UserRole } from '@prisma/client';

export interface TestUserResult {
  token: string;
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Creates a unique test user and returns a signed JWT token.
 *
 * Because cleanDb() truncates between tests, every beforeEach call to this
 * helper gets a fresh user. Pass a `suffix` to keep the email readable.
 */
export async function createTestUser(
  app: INestApplication,
  opts?: {
    suffix?: string;
    role?: UserRole;
    displayName?: string;
  },
): Promise<TestUserResult> {
  const prisma = app.get<PrismaService>(PrismaService);
  const jwtService = app.get<JwtService>(JwtService);
  const configService = app.get<ConfigService>(ConfigService);
  const jwtSecret = configService.get<string>('JWT_SECRET');

  const suffix = opts?.suffix ?? Date.now().toString();
  const email = `test-${suffix}@e2e.local`;
  const role = opts?.role ?? UserRole.LEARNER;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: 'e2e-hash',
      displayName: opts?.displayName ?? `Test User ${suffix}`,
      role,
    },
  });

  const token = jwtService.sign(
    { sub: user.id, email: user.email, role: user.role },
    { secret: jwtSecret, expiresIn: '1h' },
  );

  return { token, userId: user.id, email: user.email, role: user.role };
}

/**
 * Creates an admin test user.
 */
export async function createAdminUser(
  app: INestApplication,
  suffix?: string,
): Promise<TestUserResult> {
  return createTestUser(app, { suffix, role: UserRole.ADMIN });
}
