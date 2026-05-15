-- Migration: 20260529000002_squads_schema
-- US-505 / RFC-011 Decision D5: Squads are Organization rows with kind = 'SQUAD'.
-- Adds OrgKind enum, kind column, squad-specific fields (certificationId, targetExamDate),
-- and an FK from organizations to certifications for squad cert context.

-- 1. Enum
CREATE TYPE "OrgKind" AS ENUM ('ORG', 'SQUAD');

-- 2. New columns on organizations
ALTER TABLE "organizations"
  ADD COLUMN "kind"             "OrgKind"    NOT NULL DEFAULT 'ORG',
  ADD COLUMN "certification_id" UUID         NULL,
  ADD COLUMN "target_exam_date" TIMESTAMPTZ  NULL;

-- 3. FK: squad → certification (optional, only for SQUAD rows)
ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_certification_id_fkey"
    FOREIGN KEY ("certification_id")
    REFERENCES "certifications" ("id")
    ON DELETE SET NULL;

-- 4. Index to support Squad Dashboard queries by (kind, cert)
CREATE INDEX "organizations_kind_certification_id_idx"
  ON "organizations" ("kind", "certification_id");

COMMENT ON COLUMN "organizations"."kind" IS
  'RFC-011: ORG = company org, SQUAD = user-led study group.';
COMMENT ON COLUMN "organizations"."certification_id" IS
  'RFC-011: For SQUAD kind — the target certification.';
COMMENT ON COLUMN "organizations"."target_exam_date" IS
  'RFC-011: For SQUAD kind — optional target exam date.';
