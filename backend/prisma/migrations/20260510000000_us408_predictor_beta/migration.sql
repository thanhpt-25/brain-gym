-- US-408: Predictor accuracy harness + 200-user beta opt-in.
-- Adds per-user feature flags JSON and the pass-likelihood self-report survey table.

-- 1. Add feature_flags column to users (default empty object).
ALTER TABLE "users"
  ADD COLUMN "feature_flags" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. New survey table: one response per (user, certification).
CREATE TABLE "pass_likelihood_surveys" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "user_id"          TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "certification_id" TEXT NOT NULL REFERENCES "certifications"("id") ON DELETE CASCADE,
  "score"            INTEGER NOT NULL,
  "submitted_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "pass_likelihood_surveys_score_range_check"
    CHECK ("score" BETWEEN 1 AND 10),
  CONSTRAINT "pass_likelihood_surveys_user_cert_unique"
    UNIQUE ("user_id", "certification_id")
);

CREATE INDEX "pass_likelihood_surveys_certification_id_idx"
  ON "pass_likelihood_surveys" ("certification_id");
