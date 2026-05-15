-- RFC-008 (Sprint 5 US-503): Behavioral Insights v0.
-- Nightly job `insights:behavioral:nightly` upserts one row per (user_id, certification_id, kind, generated_for).
-- HUMAN-WRITTEN MIGRATION: review before `prisma migrate deploy`.
--
-- Rollback:
--   DROP TABLE IF EXISTS "behavioral_insights";

CREATE TABLE "behavioral_insights" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "certification_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "generated_for" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "behavioral_insights_pkey" PRIMARY KEY ("id")
);

-- Idempotency: re-running the nightly job within the same UTC day upserts the same row.
CREATE UNIQUE INDEX "behavioral_insights_user_cert_kind_for_key"
    ON "behavioral_insights"("user_id", "certification_id", "kind", "generated_for");

-- "What insights has this user accumulated lately?" (FE banner fetch).
CREATE INDEX "behavioral_insights_user_id_generated_for_idx"
    ON "behavioral_insights"("user_id", "generated_for");

-- Cohort analytics: "what % of users got 'slow_on_long_stems' this week?".
CREATE INDEX "behavioral_insights_certification_id_kind_idx"
    ON "behavioral_insights"("certification_id", "kind");

-- Sanity guard: evidence_count must be non-negative; payload must be a JSON object.
ALTER TABLE "behavioral_insights"
    ADD CONSTRAINT "behavioral_insights_evidence_count_nonneg"
    CHECK ("evidence_count" >= 0);

ALTER TABLE "behavioral_insights"
    ADD CONSTRAINT "behavioral_insights_payload_object"
    CHECK (jsonb_typeof("payload") = 'object');

ALTER TABLE "behavioral_insights"
    ADD CONSTRAINT "behavioral_insights_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "behavioral_insights"
    ADD CONSTRAINT "behavioral_insights_certification_id_fkey"
    FOREIGN KEY ("certification_id") REFERENCES "certifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
