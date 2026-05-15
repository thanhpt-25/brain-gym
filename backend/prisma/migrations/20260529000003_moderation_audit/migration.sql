-- Migration: 20260529000003_moderation_audit
-- US-508 Reviewer Queue MVP: add ModerationAction enum and ModerationAudit table.

-- 1. Enum
CREATE TYPE "ModerationAction" AS ENUM ('ACCEPTED', 'REJECTED');

-- 2. Audit table
CREATE TABLE "moderation_audits" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "question_id" UUID         NOT NULL,
  "reviewer_id" UUID         NOT NULL,
  "action"      "ModerationAction" NOT NULL,
  "reason"      TEXT         NULL,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "moderation_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "moderation_audits_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "questions" ("id") ON DELETE CASCADE,
  CONSTRAINT "moderation_audits_reviewer_id_fkey"
    FOREIGN KEY ("reviewer_id") REFERENCES "users" ("id") ON DELETE RESTRICT,
  -- Enforce reason presence for REJECTED actions at DB level
  CONSTRAINT "moderation_audits_rejection_reason_check"
    CHECK (
      ("action" <> 'REJECTED') OR
      ("reason" IS NOT NULL AND char_length("reason") >= 10)
    )
);

CREATE INDEX "moderation_audits_question_id_idx" ON "moderation_audits" ("question_id");
CREATE INDEX "moderation_audits_reviewer_id_idx" ON "moderation_audits" ("reviewer_id");

COMMENT ON TABLE "moderation_audits" IS
  'US-508: Immutable audit trail for Accept/Reject actions in the Reviewer Queue.';
