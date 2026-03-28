-- Add soft-delete column to questions table
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
