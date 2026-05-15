-- Migration: 20260529000001_org_llm_daily_cap
-- US-507 / RFC-012 v1: Add per-org daily LLM spending cap.
-- NULL means fall back to the LLM_DAILY_QUOTA_USD env var (default $5/day).

ALTER TABLE "organizations"
  ADD COLUMN "llm_daily_usd_cap" DECIMAL(10, 2) NULL;

COMMENT ON COLUMN "organizations"."llm_daily_usd_cap" IS
  'RFC-012: Per-org daily LLM spending cap in USD. NULL = use LLM_DAILY_QUOTA_USD env var.';
