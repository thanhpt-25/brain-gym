-- =========================================================
-- Idempotent migration: reconcile schema.prisma with prior
-- migration SQL that was written against an older schema.
-- Safe to run on both fresh and pre-existing databases.
-- =========================================================

-- 1. Create providers table (was never in any migration)
CREATE TABLE IF NOT EXISTS "providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "website" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "providers_name_key" ON "providers"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "providers_slug_key" ON "providers"("slug");

-- 2. Handle certifications table:
--    - The init migration created it with "provider TEXT NOT NULL" (old design).
--    - The current schema uses "provider_id TEXT" FK to providers.
--    - We need to: make old "provider" column nullable (so Prisma inserts don't fail),
--      add "provider_id" column, and add the FK constraint.
DO $$
BEGIN
    -- Make legacy "provider" column nullable if it still exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'certifications' AND column_name = 'provider'
    ) THEN
        ALTER TABLE "certifications" ALTER COLUMN "provider" DROP NOT NULL;
    END IF;

    -- Add provider_id column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'certifications' AND column_name = 'provider_id'
    ) THEN
        ALTER TABLE "certifications" ADD COLUMN "provider_id" TEXT;
    END IF;

    -- Add FK constraint if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'certifications_provider_id_fkey'
          AND table_name = 'certifications'
    ) THEN
        ALTER TABLE "certifications"
            ADD CONSTRAINT "certifications_provider_id_fkey"
            FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- 3. Add missing columns to users table
--    Also cover "status" in case migration 00001 was baselined (not run) on an existing DB.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserStatus') THEN
        CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');
    END IF;
END $$;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_until" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ban_reason" TEXT;

-- 4. Create audit_logs table (was never in any migration)
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'audit_logs_user_id_fkey'
          AND table_name = 'audit_logs'
    ) THEN
        ALTER TABLE "audit_logs"
            ADD CONSTRAINT "audit_logs_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
