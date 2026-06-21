-- Sprint 3: Competency Certifications (US-B3), Manager Review & IDP (US-B4),
--           Risk Proctoring fields (US-D2)

-- ─── US-B3: New fields on competencies ───────────────────────────────────────

ALTER TABLE "competencies"
    ADD COLUMN "validity_months" INTEGER NOT NULL DEFAULT 12;

-- ─── US-D2: Risk fields on assessments ───────────────────────────────────────

ALTER TABLE "assessments"
    ADD COLUMN "risk_threshold" INTEGER NOT NULL DEFAULT 70,
    ADD COLUMN "auto_flag_risk" BOOLEAN NOT NULL DEFAULT true;

-- ─── US-D2: Flag fields on candidate_invites ─────────────────────────────────

ALTER TABLE "candidate_invites"
    ADD COLUMN "is_flagged"      BOOLEAN   NOT NULL DEFAULT false,
    ADD COLUMN "flagged_at"      TIMESTAMP(3),
    ADD COLUMN "flagged_reason"  TEXT,
    ADD COLUMN "flagged_by"      TEXT;

-- ─── US-B3: Competency Certifications ────────────────────────────────────────

CREATE TABLE "competency_certifications" (
    "id"            TEXT NOT NULL,
    "org_id"        TEXT NOT NULL,
    "member_id"     TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "campaign_id"   TEXT,
    "achieved_level" INTEGER NOT NULL,
    "issued_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at"    TIMESTAMP(3) NOT NULL,
    "revoked_at"    TIMESTAMP(3),

    CONSTRAINT "competency_certifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "competency_certifications_member_id_competency_id_issued_at_key"
    ON "competency_certifications"("member_id", "competency_id", "issued_at");
CREATE INDEX "competency_certifications_org_id_competency_id_idx"
    ON "competency_certifications"("org_id", "competency_id");
CREATE INDEX "competency_certifications_member_id_idx"
    ON "competency_certifications"("member_id");
CREATE INDEX "competency_certifications_expires_at_idx"
    ON "competency_certifications"("expires_at");

ALTER TABLE "competency_certifications"
    ADD CONSTRAINT "competency_certifications_org_id_fkey"
        FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "competency_certifications_member_id_fkey"
        FOREIGN KEY ("member_id") REFERENCES "org_members"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "competency_certifications_competency_id_fkey"
        FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON UPDATE CASCADE,
    ADD CONSTRAINT "competency_certifications_campaign_id_fkey"
        FOREIGN KEY ("campaign_id") REFERENCES "assessment_campaigns"("id") ON UPDATE CASCADE;

-- ─── US-B4: Campaign Member Reviews ──────────────────────────────────────────

CREATE TABLE "campaign_member_reviews" (
    "id"          TEXT NOT NULL,
    "org_id"      TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "member_id"   TEXT NOT NULL,
    "reviewed_by" TEXT NOT NULL,
    "note"        TEXT NOT NULL,
    "direction"   TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_member_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "campaign_member_reviews_campaign_id_member_id_key"
    ON "campaign_member_reviews"("campaign_id", "member_id");
CREATE INDEX "campaign_member_reviews_org_id_member_id_idx"
    ON "campaign_member_reviews"("org_id", "member_id");

ALTER TABLE "campaign_member_reviews"
    ADD CONSTRAINT "campaign_member_reviews_org_id_fkey"
        FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "campaign_member_reviews_campaign_id_fkey"
        FOREIGN KEY ("campaign_id") REFERENCES "assessment_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "campaign_member_reviews_member_id_fkey"
        FOREIGN KEY ("member_id") REFERENCES "org_members"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "campaign_member_reviews_reviewed_by_fkey"
        FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON UPDATE CASCADE;

-- ─── US-B4: Member IDPs ───────────────────────────────────────────────────────

CREATE TABLE "member_idps" (
    "id"            TEXT NOT NULL,
    "org_id"        TEXT NOT NULL,
    "member_id"     TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "track_id"      TEXT NOT NULL,
    "target_level"  INTEGER NOT NULL,
    "due_date"      TIMESTAMP(3),
    "completed_at"  TIMESTAMP(3),
    "created_by"    TEXT NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_idps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "member_idps_member_id_competency_id_track_id_key"
    ON "member_idps"("member_id", "competency_id", "track_id");
CREATE INDEX "member_idps_org_id_member_id_idx"
    ON "member_idps"("org_id", "member_id");

ALTER TABLE "member_idps"
    ADD CONSTRAINT "member_idps_org_id_fkey"
        FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "member_idps_member_id_fkey"
        FOREIGN KEY ("member_id") REFERENCES "org_members"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "member_idps_competency_id_fkey"
        FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON UPDATE CASCADE,
    ADD CONSTRAINT "member_idps_track_id_fkey"
        FOREIGN KEY ("track_id") REFERENCES "learning_tracks"("id") ON UPDATE CASCADE,
    ADD CONSTRAINT "member_idps_created_by_fkey"
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON UPDATE CASCADE;
