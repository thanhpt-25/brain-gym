-- US-1101: DDS auto-apply config per cohort
-- Tracks shadow mode state and canary monitoring for cohort-level promotion to live

CREATE TABLE "dds_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cohort_name" TEXT NOT NULL UNIQUE,
    "shadow_mode_enabled" BOOLEAN NOT NULL DEFAULT true,
    "canary_armed" BOOLEAN NOT NULL DEFAULT false,
    "promoted_at" TIMESTAMP(3),
    "promoted_by" TEXT,
    "canary_paused_at" TIMESTAMP(3),
    "canary_auto_resume_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dds_configs_promoted_by_fkey" FOREIGN KEY ("promoted_by") REFERENCES "users" ("id") ON DELETE SET NULL
);

-- Index for fast cohort lookup
CREATE INDEX "dds_configs_cohort_name_idx" ON "dds_configs"("cohort_name");

-- Insert default cohort config (starts in shadow mode)
INSERT INTO "dds_configs" ("id", "cohort_name", "shadow_mode_enabled", "canary_armed", "created_at", "updated_at")
VALUES (
    'default-dds-config',
    'default',
    true,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
