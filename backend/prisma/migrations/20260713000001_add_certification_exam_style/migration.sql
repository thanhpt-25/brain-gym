-- Add exam_style column to certifications
-- Stores a short description of the exam's question style, injected into AI generation prompts.
ALTER TABLE "certifications" ADD COLUMN "exam_style" TEXT;
