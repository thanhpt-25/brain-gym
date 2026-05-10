/**
 * US-408 — Seed the Pass Predictor beta cohort.
 *
 * Usage:
 *   npx ts-node backend/scripts/seed-beta-cohort.ts <path-to-emails.csv>
 *
 * The CSV must contain a header row with an `email` column. Lines without an
 * `@` are skipped. For every matching user, sets
 * `featureFlags.passPredictorBeta = true` (preserving existing flags).
 *
 * The CSV is operator-supplied and must NOT be committed to the repo.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FLAG_KEY = 'passPredictorBeta';

async function main() {
  const csvArg = process.argv[2];
  if (!csvArg) {
    console.error('Usage: seed-beta-cohort.ts <path-to-emails.csv>');
    process.exit(1);
  }

  const csvPath = resolve(csvArg);
  const raw = readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    console.error('CSV is empty');
    process.exit(1);
  }

  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
  const emailIdx = header.indexOf('email');
  if (emailIdx < 0) {
    console.error('CSV must have an "email" column');
    process.exit(1);
  }

  const emails: string[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((c) => c.trim());
    const email = cells[emailIdx];
    if (email && email.includes('@')) emails.push(email.toLowerCase());
  }

  if (emails.length === 0) {
    console.error('No valid email rows found');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  let flagged = 0;
  let missing = 0;

  try {
    for (const email of emails) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, featureFlags: true },
      });
      if (!user) {
        missing += 1;
        console.warn(`miss: no user with email=${email}`);
        continue;
      }
      const existing =
        (user.featureFlags as Record<string, unknown> | null) ?? {};
      const merged = { ...existing, [FLAG_KEY]: true };
      await prisma.user.update({
        where: { id: user.id },
        data: { featureFlags: merged as Prisma.InputJsonValue },
      });
      flagged += 1;
    }

    console.log(
      `done: flagged=${flagged} missing=${missing} total=${emails.length}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
