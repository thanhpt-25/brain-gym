-- Sprint 09 / US-807 / RFC-007: pgvector extension + QuestionEmbedding table
-- Sprint 09 / US-017a: CertOverlap table for cross-cert knowledge graph
-- Sprint 09 / US-018 / RFC-010: QuestionVariant table for Dynamic Difficulty Scaling
-- Sprint 09 / US-020: PeerExplanation table for peer review challenges

-- ─── pgvector extension ───────────────────────────────────────────────────────
-- Requires pgvector/pgvector:16-pg16 (or equivalent) Postgres image.
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── VoteTargetType enum: add EXPLANATION value ───────────────────────────────
ALTER TYPE "VoteTargetType" ADD VALUE IF NOT EXISTS 'EXPLANATION';

-- ─── DdsReason enum ──────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "DdsReason" AS ENUM ('DDS_HARDEN', 'DDS_SOFTEN', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── DdsVariantStatus enum ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "DdsVariantStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ROLLED_BACK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── question_embeddings ─────────────────────────────────────────────────────
-- Raw SQL: Prisma doesn't support pgvector column type natively (RFC-007 strategy).
CREATE TABLE IF NOT EXISTS "question_embeddings" (
  "question_id" TEXT        NOT NULL,
  "model_id"    TEXT        NOT NULL DEFAULT 'text-embedding-3-small',
  "embedding"   vector(1536),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "question_embeddings_pkey" PRIMARY KEY ("question_id"),
  CONSTRAINT "question_embeddings_question_fk"
    FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "question_embeddings_model_idx" ON "question_embeddings"("model_id");

-- IVFFlat index: run separately after ≥10k rows are backfilled (RFC-007):
--   CREATE INDEX CONCURRENTLY question_embeddings_ivfflat_idx
--   ON question_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── cert_overlaps ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "cert_overlaps" (
  "id"             TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "cert_a_id"      TEXT        NOT NULL,
  "cert_b_id"      TEXT        NOT NULL,
  "domain_a_id"    TEXT,
  "domain_b_id"    TEXT,
  "overlap_pct"    FLOAT       NOT NULL DEFAULT 0.0,
  "shared_topics"  JSONB       NOT NULL DEFAULT '[]',
  "computed_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "cert_overlaps_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cert_overlaps_cert_a_fk"
    FOREIGN KEY ("cert_a_id") REFERENCES "certifications"("id") ON DELETE CASCADE,
  CONSTRAINT "cert_overlaps_cert_b_fk"
    FOREIGN KEY ("cert_b_id") REFERENCES "certifications"("id") ON DELETE CASCADE,
  CONSTRAINT "cert_overlaps_domain_a_fk"
    FOREIGN KEY ("domain_a_id") REFERENCES "domains"("id") ON DELETE SET NULL,
  CONSTRAINT "cert_overlaps_domain_b_fk"
    FOREIGN KEY ("domain_b_id") REFERENCES "domains"("id") ON DELETE SET NULL,
  CONSTRAINT "cert_overlaps_unique"
    UNIQUE ("cert_a_id", "cert_b_id", "domain_a_id", "domain_b_id")
);

CREATE INDEX IF NOT EXISTS "cert_overlaps_cert_a_idx" ON "cert_overlaps"("cert_a_id", "computed_at");

-- ─── question_variants ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "question_variants" (
  "id"             TEXT               NOT NULL DEFAULT gen_random_uuid()::text,
  "question_id"    TEXT               NOT NULL,
  "variant_of"     TEXT,
  "rewrite_job_id" TEXT,
  "reason"         "DdsReason"        NOT NULL DEFAULT 'DDS_HARDEN',
  "status"         "DdsVariantStatus" NOT NULL DEFAULT 'PENDING',
  "diff"           JSONB              NOT NULL DEFAULT '{}',
  "reviewed_by"    TEXT,
  "reviewed_at"    TIMESTAMPTZ,
  "review_note"    TEXT,
  "created_at"     TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT "question_variants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "question_variants_question_fk"
    FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE,
  CONSTRAINT "question_variants_reviewer_fk"
    FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "question_variants_question_status_idx"
  ON "question_variants"("question_id", "status");
CREATE INDEX IF NOT EXISTS "question_variants_created_idx"
  ON "question_variants"("created_at");

-- ─── peer_explanations ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "peer_explanations" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "question_id" TEXT        NOT NULL,
  "squad_id"    TEXT        NOT NULL,
  "author_id"   TEXT        NOT NULL,
  "content"     TEXT        NOT NULL,
  "upvotes"     INT         NOT NULL DEFAULT 0,
  "is_top"      BOOLEAN     NOT NULL DEFAULT FALSE,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "peer_explanations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "peer_explanations_question_fk"
    FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE,
  CONSTRAINT "peer_explanations_squad_fk"
    FOREIGN KEY ("squad_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "peer_explanations_author_fk"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "peer_explanations_unique_author"
    UNIQUE ("question_id", "squad_id", "author_id")
);

CREATE INDEX IF NOT EXISTS "peer_explanations_question_squad_idx"
  ON "peer_explanations"("question_id", "squad_id", "upvotes" DESC);
CREATE INDEX IF NOT EXISTS "peer_explanations_squad_created_idx"
  ON "peer_explanations"("squad_id", "created_at");
