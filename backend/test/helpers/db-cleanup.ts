import { PrismaClient } from '@prisma/client';

/**
 * Truncate all tables safely using CASCADE to handle FK relationships.
 * PostgreSQL's TRUNCATE ... CASCADE removes all dependent data automatically,
 * avoiding FK constraint violations that occur with complex schemas.
 *
 * Call this in beforeEach to guarantee full isolation between tests.
 */
export async function cleanDb(prisma: PrismaClient): Promise<void> {
  // Get all tables in the public schema
  const result = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
  `;

  const tables = result.map((r) => r.table_name);

  if (tables.length === 0) return;

  // Use TRUNCATE ... CASCADE to handle all FK relationships automatically
  // This is the safest approach for complex schemas
  const tableList = tables.map((t) => `"${t}"`).join(', ');

  try {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
    );
  } catch (error) {
    // If TRUNCATE fails, fall back to individual table truncation
    // This handles edge cases where CASCADE might have issues
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`,
        );
      } catch (err) {
        // Table might not exist or might have circular FK, skip
        console.warn(`Failed to truncate ${table}:`, err instanceof Error ? err.message : err);
      }
    }
  }
}
