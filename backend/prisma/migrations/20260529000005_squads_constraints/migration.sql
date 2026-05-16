-- Add CHECK constraint: Squads cannot own ExamCatalogItem
ALTER TABLE "ExamCatalogItem" ADD CONSTRAINT chk_catalog_non_squad
  CHECK (
    org_id NOT IN (
      SELECT id FROM "Organization" WHERE kind = 'SQUAD'
    )
  );

-- Add CHECK constraint: Squads cannot own Assessment
ALTER TABLE "Assessment" ADD CONSTRAINT chk_assessment_non_squad
  CHECK (
    org_id NOT IN (
      SELECT id FROM "Organization" WHERE kind = 'SQUAD'
    )
  );

-- Index on OrgInvite for efficient daily rate limit query
CREATE INDEX idx_orginvite_squad_daily_limit
  ON "OrgInvite"(org_id, invited_by, created_at)
  WHERE status = 'PENDING';
