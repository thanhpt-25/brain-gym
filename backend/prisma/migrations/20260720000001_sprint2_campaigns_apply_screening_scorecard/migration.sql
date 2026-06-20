-- Sprint 2: Assessment Campaigns (US-B1/B2), Public Apply Links (US-C2),
--           Auto-Screening Rules (US-E1), Competency Scorecard (US-E3)

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
CREATE TYPE "RecurrenceInterval" AS ENUM ('MONTHLY_3', 'MONTHLY_6', 'MONTHLY_12');
CREATE TYPE "ScreeningAction" AS ENUM ('SHORTLIST', 'REJECT');

-- ─── US-B1/B2: Assessment Campaigns ──────────────────────────────────────────

CREATE TABLE "assessment_campaigns" (
    "id"                  TEXT NOT NULL,
    "org_id"              TEXT NOT NULL,
    "name"                TEXT NOT NULL,
    "description"         TEXT,
    "kind"                TEXT NOT NULL DEFAULT 'INTERNAL',
    "catalog_item_id"     TEXT NOT NULL,
    "due_date"            TIMESTAMP(3),
    "status"              "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "recurrence_enabled"  BOOLEAN NOT NULL DEFAULT false,
    "recurrence_interval" "RecurrenceInterval",
    "next_run_at"         TIMESTAMP(3),
    "parent_campaign_id"  TEXT,
    "created_by"          TEXT NOT NULL,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assessment_campaigns_org_id_name_key" ON "assessment_campaigns"("org_id", "name");
CREATE INDEX "assessment_campaigns_org_id_idx" ON "assessment_campaigns"("org_id");

ALTER TABLE "assessment_campaigns"
    ADD CONSTRAINT "assessment_campaigns_org_id_fkey"
        FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "assessment_campaigns_catalog_item_id_fkey"
        FOREIGN KEY ("catalog_item_id") REFERENCES "exam_catalog_items"("id") ON UPDATE CASCADE,
    ADD CONSTRAINT "assessment_campaigns_created_by_fkey"
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON UPDATE CASCADE;

-- Extend org_exam_assignments with campaign support
ALTER TABLE "org_exam_assignments"
    ADD COLUMN "campaign_id"     TEXT,
    ADD COLUMN "reminder_opt_out" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "org_exam_assignments_campaign_id_idx" ON "org_exam_assignments"("campaign_id");

ALTER TABLE "org_exam_assignments"
    ADD CONSTRAINT "org_exam_assignments_campaign_id_fkey"
        FOREIGN KEY ("campaign_id") REFERENCES "assessment_campaigns"("id") ON UPDATE CASCADE ON DELETE SET NULL;

-- ─── US-C2: Public Apply Links ────────────────────────────────────────────────

CREATE TABLE "public_apply_links" (
    "id"            TEXT NOT NULL,
    "org_id"        TEXT NOT NULL,
    "job_role_id"   TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "code"          TEXT NOT NULL,
    "is_active"     BOOLEAN NOT NULL DEFAULT true,
    "max_uses"      INTEGER,
    "current_uses"  INTEGER NOT NULL DEFAULT 0,
    "expires_at"    TIMESTAMP(3),
    "created_by"    TEXT NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_apply_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_apply_links_code_key" ON "public_apply_links"("code");
CREATE INDEX "public_apply_links_org_id_idx" ON "public_apply_links"("org_id");

ALTER TABLE "public_apply_links"
    ADD CONSTRAINT "public_apply_links_org_id_fkey"
        FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "public_apply_links_job_role_id_fkey"
        FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON UPDATE CASCADE,
    ADD CONSTRAINT "public_apply_links_assessment_id_fkey"
        FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON UPDATE CASCADE,
    ADD CONSTRAINT "public_apply_links_created_by_fkey"
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON UPDATE CASCADE;

-- Extend candidate_invites with apply-link metadata
ALTER TABLE "candidate_invites"
    ADD COLUMN "consented_at"  TIMESTAMP(3),
    ADD COLUMN "apply_link_id" TEXT;

-- ─── US-E1: Screening Rules & Decision Log ────────────────────────────────────

CREATE TABLE "screening_rules" (
    "id"                TEXT NOT NULL,
    "org_id"            TEXT NOT NULL,
    "assessment_id"     TEXT NOT NULL,
    "action"            "ScreeningAction" NOT NULL,
    "min_score"         DECIMAL(5,2),
    "max_score"         DECIMAL(5,2),
    "min_integrity"     INTEGER,
    "min_domain_scores" JSONB,
    "priority"          INTEGER NOT NULL DEFAULT 0,
    "is_active"         BOOLEAN NOT NULL DEFAULT true,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screening_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "screening_rules_assessment_id_is_active_priority_idx"
    ON "screening_rules"("assessment_id", "is_active", "priority");

ALTER TABLE "screening_rules"
    ADD CONSTRAINT "screening_rules_org_id_fkey"
        FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "screening_rules_assessment_id_fkey"
        FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "decision_logs" (
    "id"             TEXT NOT NULL,
    "invite_id"      TEXT NOT NULL,
    "from_stage"     TEXT,
    "to_stage"       TEXT NOT NULL,
    "decided_by"     TEXT NOT NULL,
    "rule_id"        TEXT,
    "rule_snapshot"  JSONB,
    "score_snapshot" JSONB,
    "note"           TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "decision_logs_invite_id_idx" ON "decision_logs"("invite_id");

ALTER TABLE "decision_logs"
    ADD CONSTRAINT "decision_logs_invite_id_fkey"
        FOREIGN KEY ("invite_id") REFERENCES "candidate_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── US-E3: Exam Domain → Competency Mapping ──────────────────────────────────

CREATE TABLE "exam_domain_competencies" (
    "id"             TEXT NOT NULL,
    "assessment_id"  TEXT NOT NULL,
    "domain_key"     TEXT NOT NULL,
    "competency_id"  TEXT NOT NULL,
    "weight"         DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_domain_competencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_domain_competencies_assessment_id_domain_key_key"
    ON "exam_domain_competencies"("assessment_id", "domain_key");
CREATE INDEX "exam_domain_competencies_assessment_id_idx" ON "exam_domain_competencies"("assessment_id");
CREATE INDEX "exam_domain_competencies_competency_id_idx" ON "exam_domain_competencies"("competency_id");

ALTER TABLE "exam_domain_competencies"
    ADD CONSTRAINT "exam_domain_competencies_assessment_id_fkey"
        FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "exam_domain_competencies_competency_id_fkey"
        FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
