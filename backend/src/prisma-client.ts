/**
 * Single re-export point for the Prisma 7 generated client.
 *
 * Prisma 7's `prisma-client` generator no longer writes into
 * `node_modules/@prisma/client` — it generates plain TypeScript into a
 * custom `output` path (see `prisma/schema.prisma`'s `generator client`
 * block, which outputs to `src/generated/prisma`). Application code
 * should import `PrismaClient`, `Prisma`, model types, and enums from
 * this file instead of `@prisma/client` directly, so the generated
 * output path only needs to be known in one place.
 */
export * from './generated/prisma/client';
