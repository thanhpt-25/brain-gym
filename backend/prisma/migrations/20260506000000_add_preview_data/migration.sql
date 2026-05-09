-- Add preview_data column to question_generation_jobs table
ALTER TABLE "question_generation_jobs" ADD COLUMN "preview_data" JSONB;
