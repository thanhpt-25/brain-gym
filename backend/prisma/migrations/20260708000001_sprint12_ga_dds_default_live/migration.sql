-- Sprint 12 GA: promote default DDS cohort from shadow mode to live
-- The 'default' row was seeded by 20260624000002_sprint11_dds_config with shadow_mode_enabled=true.
-- This migration flips it to live (shadow_mode_enabled=false, canary_armed=true) so the GA release
-- applies auto-apply for all users without requiring a manual admin promotion click.

UPDATE "dds_configs"
SET
    "shadow_mode_enabled" = false,
    "canary_armed"        = true,
    "updated_at"          = CURRENT_TIMESTAMP
WHERE "cohort_name" = 'default';
