-- Migration: flashcard_srs_fields
-- Renames interval → interval_days in flashcard_review_schedules to match
-- the Prisma model field intervalDays, and adds the lapses counter column.

-- Rename interval → interval_days (preserves existing data)
ALTER TABLE "flashcard_review_schedules" RENAME COLUMN "interval" TO "interval_days";

-- Add lapse counter (incremented each time quality < 3)
ALTER TABLE "flashcard_review_schedules" ADD COLUMN "lapses" INTEGER NOT NULL DEFAULT 0;
