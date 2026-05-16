-- Note: Constraints moved to service layer (PostgreSQL doesn't allow subqueries in CHECK)
-- Application layer enforces: Squads cannot own exam_catalog_items or assessments

-- Index on org_invites for efficient daily rate limit query
CREATE INDEX IF NOT EXISTS idx_orginvite_squad_daily_limit
  ON "org_invites"(org_id, invited_by, created_at)
  WHERE status = 'PENDING';
