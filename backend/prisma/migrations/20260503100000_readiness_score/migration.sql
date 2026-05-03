-- RFC-003 (Sprint 4 US-401): Pass Predictor v0 output table.
-- One row per (user_id, certification_id); upserted by readiness:recompute job.
-- HUMAN-WRITTEN MIGRATION: review before `prisma migrate deploy`.
--
-- Rollback:
--   DROP TABLE IF EXISTS "readiness_scores";

CREATE TABLE "readiness_scores" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "certification_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "signals" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "readiness_scores_pkey" PRIMARY KEY ("id")
);

-- Enforces "one score per user per cert"; the recompute job upserts on this key.
CREATE UNIQUE INDEX "readiness_scores_user_id_certification_id_key"
    ON "readiness_scores"("user_id", "certification_id");

-- Cohort queries: "top N scorers in cert X" / "% of users in 'Ready' band".
CREATE INDEX "readiness_scores_certification_id_score_idx"
    ON "readiness_scores"("certification_id", "score");

ALTER TABLE "readiness_scores"
    ADD CONSTRAINT "readiness_scores_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "readiness_scores"
    ADD CONSTRAINT "readiness_scores_certification_id_fkey"
    FOREIGN KEY ("certification_id") REFERENCES "certifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
