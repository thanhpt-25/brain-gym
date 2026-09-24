-- Fix: deleting an exam that already had attempts failed with a 500 because
-- exam_attempts.exam_id references exams with ON DELETE RESTRICT. Such exams
-- are now soft-deleted so attempt history and analytics are preserved.

ALTER TABLE "exams" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "exams_deleted_at_idx" ON "exams"("deleted_at");
