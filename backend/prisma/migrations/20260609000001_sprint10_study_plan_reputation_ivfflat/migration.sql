-- Sprint 10 (US-1001, US-1002, US-1005)
-- Adds: study_plans, user_reputations, IVFFlat index on question_embeddings

-- US-1002: Persisted study plan generated from Knowledge Graph overlap
CREATE TABLE "study_plans" (
  "id"                   TEXT         NOT NULL,
  "user_id"              TEXT         NOT NULL,
  "target_cert_id"       TEXT         NOT NULL,
  "source_cert_ids"      TEXT[]       NOT NULL DEFAULT '{}',
  "skip_topics"          JSONB        NOT NULL DEFAULT '[]',
  "must_learn_topics"    JSONB        NOT NULL DEFAULT '[]',
  "effort_reduction_pct" INTEGER      NOT NULL DEFAULT 0,
  "total_topics"         INTEGER      NOT NULL DEFAULT 0,
  "skippable_count"      INTEGER      NOT NULL DEFAULT 0,
  "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "study_plans_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "study_plans"
  ADD CONSTRAINT "study_plans_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "study_plans_target_cert_id_fkey"
    FOREIGN KEY ("target_cert_id") REFERENCES "certifications"("id") ON DELETE CASCADE;

CREATE INDEX "study_plans_user_id_created_at_idx" ON "study_plans"("user_id", "created_at");
CREATE INDEX "study_plans_user_id_target_cert_id_idx" ON "study_plans"("user_id", "target_cert_id");

-- US-1005: Reputation points per user per squad
CREATE TABLE "user_reputations" (
  "id"         TEXT        NOT NULL,
  "user_id"    TEXT        NOT NULL,
  "squad_id"   TEXT        NOT NULL,
  "points"     INTEGER     NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "user_reputations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_reputations_user_id_squad_id_key" UNIQUE ("user_id", "squad_id")
);

ALTER TABLE "user_reputations"
  ADD CONSTRAINT "user_reputations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "user_reputations_squad_id_fkey"
    FOREIGN KEY ("squad_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

CREATE INDEX "user_reputations_squad_id_points_idx" ON "user_reputations"("squad_id", "points" DESC);

-- US-1001: IVFFlat index on question_embeddings for fast cosine similarity.
-- Production: run manually with CONCURRENTLY after row count >= 10k:
--   CREATE INDEX CONCURRENTLY question_embeddings_ivfflat_idx
--     ON question_embeddings USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS question_embeddings_ivfflat_idx;
--
-- Dev/test: created inline when table exists and has enough rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'question_embeddings'
  ) AND (
    SELECT COUNT(*) FROM question_embeddings
  ) >= 10000 THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS question_embeddings_ivfflat_idx
             ON question_embeddings USING ivfflat (embedding vector_cosine_ops)
             WITH (lists = 100)';
  END IF;
END
$$;
