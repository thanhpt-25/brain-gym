import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 removed the package.json "prisma" key and the schema's
// datasource `url = env("DATABASE_URL")` field. This file is now the
// single source of truth the Prisma CLI (generate/migrate/db seed) uses
// for the schema location, the migrations folder, the seed command, and
// the database connection string.
//
// Note: this only configures the CLI. The application's PrismaClient
// instance (see src/prisma/prisma.service.ts) still receives its own
// connection string via a `@prisma/adapter-pg` driver adapter, which is
// mandatory for every database in Prisma 7.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npm run seed',
  },
  datasource: {
    // Use `process.env` directly (not the `env()` helper) so that
    // `prisma generate` keeps working in CI jobs that don't set
    // DATABASE_URL (it doesn't need a live connection to generate the
    // client), instead of throwing on a missing variable.
    url: process.env.DATABASE_URL as string,
  },
});
