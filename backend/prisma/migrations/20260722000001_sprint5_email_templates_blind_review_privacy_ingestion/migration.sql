-- Sprint 5: Email Templates (US-C3), Blind Review (US-G3),
--           Data Privacy / Retention (US-G2), Document Ingestion (US-1200),
--           Interview Packet Tokens (US-F1), Interview Stage (US-F2)

-- ─── Enums ───────────────────────────────────────────────────────────────────

-- US-F2: Add INTERVIEW stage value to existing enum
ALTER TYPE "CandidateStage" ADD VALUE 'INTERVIEW';

CREATE TYPE "EmailTemplateTrigger" AS ENUM (
  'INVITE',
  'SHORTLISTED',
  'INTERVIEW',
  'REJECTED',
  'HIRED'
);

CREATE TYPE "IngestionJobStatus" AS ENUM (
  'PENDING',
  'EXTRACTING',
  'ENRICHING',
  'COMPLETED',
  'FAILED'
);

-- ─── US-G2: Data retention field on organizations ────────────────────────────

ALTER TABLE "organizations"
    ADD COLUMN "data_retention_months" INTEGER NOT NULL DEFAULT 12;

-- ─── US-F2: Interview scheduling field on candidate_invites ─────────────────

ALTER TABLE "candidate_invites"
    ADD COLUMN "interview_scheduled_at" TIMESTAMP(3);

-- ─── US-G2: Privacy / anonymisation fields on candidate_invites ──────────────

ALTER TABLE "candidate_invites"
    ADD COLUMN "delete_requested_at" TIMESTAMP(3),
    ADD COLUMN "anonymized_at"       TIMESTAMP(3);

-- ─── US-G3: Blind review flag on assessments ─────────────────────────────────

ALTER TABLE "assessments"
    ADD COLUMN "blind_review_enabled" BOOLEAN NOT NULL DEFAULT false;

-- ─── US-1200: Document ingestion fields on questions ─────────────────────────

ALTER TABLE "questions"
    ADD COLUMN "ingestion_job_id"    TEXT,
    ADD COLUMN "answer_confidence"   DECIMAL(3, 2),
    ADD COLUMN "source_content_hash" TEXT;

-- ─── US-F1: Interview Packet Token table ─────────────────────────────────────

CREATE TABLE "interview_packet_tokens" (
    "id"         TEXT NOT NULL,
    "invite_id"  TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_packet_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "interview_packet_tokens_token_key"
    ON "interview_packet_tokens"("token");

CREATE INDEX "interview_packet_tokens_invite_id_idx"
    ON "interview_packet_tokens"("invite_id");

CREATE INDEX "interview_packet_tokens_expires_at_idx"
    ON "interview_packet_tokens"("expires_at");

ALTER TABLE "interview_packet_tokens"
    ADD CONSTRAINT "interview_packet_tokens_invite_id_fkey"
        FOREIGN KEY ("invite_id") REFERENCES "candidate_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "interview_packet_tokens_created_by_fkey"
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON UPDATE CASCADE;

-- ─── US-C3: Email Templates table ────────────────────────────────────────────

CREATE TABLE "email_templates" (
    "id"         TEXT NOT NULL,
    "org_id"     TEXT NOT NULL,
    "trigger"    "EmailTemplateTrigger" NOT NULL,
    "subject"    TEXT NOT NULL,
    "body_html"  TEXT NOT NULL,
    "is_active"  BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_templates_org_id_trigger_key"
    ON "email_templates"("org_id", "trigger");

ALTER TABLE "email_templates"
    ADD CONSTRAINT "email_templates_org_id_fkey"
        FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "email_templates_created_by_fkey"
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON UPDATE CASCADE;

-- ─── US-1200: Document Ingestion Jobs table ───────────────────────────────────

CREATE TABLE "document_ingestion_jobs" (
    "id"                 TEXT NOT NULL,
    "user_id"            TEXT NOT NULL,
    "certification_id"   TEXT NOT NULL,
    "file_name"          TEXT NOT NULL,
    "file_url"           TEXT NOT NULL,
    "file_size_bytes"    INTEGER NOT NULL,
    "content_hash"       TEXT NOT NULL,
    "status"             "IngestionJobStatus" NOT NULL DEFAULT 'PENDING',
    "rights_attestation" BOOLEAN NOT NULL,
    "declared_source"    TEXT,
    "extracted_count"    INTEGER,
    "enriched_count"     INTEGER,
    "skipped_count"      INTEGER,
    "error_message"      TEXT,
    "estimated_cost_usd" DECIMAL(10, 4),
    "actual_cost_usd"    DECIMAL(10, 4),
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at"       TIMESTAMP(3),

    CONSTRAINT "document_ingestion_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_ingestion_jobs_user_id_created_at_idx"
    ON "document_ingestion_jobs"("user_id", "created_at");

CREATE INDEX "document_ingestion_jobs_content_hash_idx"
    ON "document_ingestion_jobs"("content_hash");

CREATE INDEX "document_ingestion_jobs_certification_id_idx"
    ON "document_ingestion_jobs"("certification_id");

ALTER TABLE "document_ingestion_jobs"
    ADD CONSTRAINT "document_ingestion_jobs_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE,
    ADD CONSTRAINT "document_ingestion_jobs_certification_id_fkey"
        FOREIGN KEY ("certification_id") REFERENCES "certifications"("id") ON UPDATE CASCADE;

-- ─── US-1200: FK from questions to document_ingestion_jobs ───────────────────

ALTER TABLE "questions"
    ADD CONSTRAINT "questions_ingestion_job_id_fkey"
        FOREIGN KEY ("ingestion_job_id") REFERENCES "document_ingestion_jobs"("id") ON UPDATE CASCADE;
