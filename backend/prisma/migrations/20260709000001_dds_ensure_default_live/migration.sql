-- Idempotent fix: ensure the 'default' DDS cohort is in live mode (shadow_mode_enabled=false).
-- Sprint 12 GA migration (20260708000001) used a plain UPDATE which silently affects 0 rows
-- when the 'default' row did not yet exist at migration time (e.g. fresh staging DB).
-- This migration uses INSERT ... ON CONFLICT to guarantee the correct state regardless.

INSERT INTO "dds_configs" (
    "id",
    "cohort_name",
    "shadow_mode_enabled",
    "canary_armed",
    "created_at",
    "updated_at"
)
VALUES (
    'default-dds-config',
    'default',
    false,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("cohort_name") DO UPDATE
SET
    "shadow_mode_enabled" = false,
    "canary_armed"        = true,
    "updated_at"          = CURRENT_TIMESTAMP
WHERE "dds_configs"."shadow_mode_enabled" = true;
