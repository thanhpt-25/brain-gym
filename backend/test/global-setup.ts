import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Jest globalSetup — runs once before the entire e2e suite.
 *
 * 1. Verifies DATABASE_URL is set.
 * 2. Confirms DB connectivity via a Prisma raw query.
 * 3. Runs `prisma migrate deploy` to ensure schema is current.
 */
export default async function globalSetup(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      '[global-setup] DATABASE_URL is not set. ' +
        'Export it before running e2e tests.',
    );
  }

  // Verify DB connection using Prisma before running migrations
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[global-setup] Database connection verified.');
  } catch (err) {
    throw new Error(
      `[global-setup] Cannot connect to database: ${(err as Error).message}`,
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
