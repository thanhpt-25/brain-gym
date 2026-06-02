-- Add per-certification passing score (percentage 0-100).
-- Nullable: existing rows default to NULL and analytics falls back to 70.
ALTER TABLE "certifications" ADD COLUMN "passing_score" INTEGER;
