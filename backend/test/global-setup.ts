import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Jest globalSetup — runs once before the entire e2e suite.
 *
 * 1. Verifies DATABASE_URL is set.
 * 2. Confirms DB connectivity via a Prisma raw query.
 * 3. Runs `prisma migrate deploy` to ensure schema is current.
 *
 * NOTE: Prisma loads .env files automatically, which may override environment
 * variables set by CI. We explicitly use process.env.DATABASE_URL which should
 * be set by the CI workflow or explicitly before running tests.
 */
export default async function globalSetup(): Promise<void> {
  // Force reload env variables - Prisma may have loaded .env files
  // In CI, DATABASE_URL should be set from the workflow
  // In local testing, ensure DATABASE_URL is properly exported
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    // Provide helpful error message
    if (process.env.NODE_ENV === 'test') {
      throw new Error(
        '[global-setup] DATABASE_URL is not set for test environment. ' +
          'Set DATABASE_URL=postgresql://braingym:braingym_test@localhost:5432/braingym_test?schema=public ' +
          'before running e2e tests.',
      );
    }
    throw new Error(
      '[global-setup] DATABASE_URL is not set. ' +
        'Export it before running e2e tests.',
    );
  }

  console.log(`[global-setup] Connecting to database...`);

  // Verify DB connection using Prisma before running migrations
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: ['error'],
  });

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[global-setup] Database connection verified.');
  } catch (err) {
    const errorMsg = (err as Error).message;
    throw new Error(
      `[global-setup] Cannot connect to database: ${errorMsg}\n` +
        `Database URL: ${dbUrl.replace(/(:)([^@]+)@/, '$1***@')}`,
    );
  } finally {
    await prisma.$disconnect();
  }

  // Apply any pending migrations
  console.log('[global-setup] Running prisma migrate deploy…');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env },
  });
  console.log('[global-setup] Migrations applied.');
}
