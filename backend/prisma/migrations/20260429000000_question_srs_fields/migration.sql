-- Migration: question_srs_fields
-- Adds SM-2 SRS tracking fields to review_schedules table.
-- Uses RENAME COLUMN to preserve existing interval data rather than DROP+ADD.

-- Rename interval → interval_days (preserves data)
ALTER TABLE "review_schedules" RENAME COLUMN "interval" TO "interval_days";

-- Add mastery level (reuses existing FlashcardMastery enum)
ALTER TABLE "review_schedules" ADD COLUMN "mastery" "FlashcardMastery" NOT NULL DEFAULT 'NEW';

-- Add last quality score (0-5 scale, nullable until first review)
ALTER TABLE "review_schedules" ADD COLUMN "last_quality" INTEGER;

-- Add lapse counter (incremented each time quality < 3)
ALTER TABLE "review_schedules" ADD COLUMN "lapses" INTEGER NOT NULL DEFAULT 0;

-- Add explicit last reviewed timestamp (decoupled from updatedAt)
ALTER TABLE "review_schedules" ADD COLUMN "last_reviewed_at" TIMESTAMP(3);

-- Index for due-review queries: fetch all cards due for a user
CREATE INDEX "review_schedules_user_id_next_review_date_idx" ON "review_schedules"("user_id", "next_review_date");
