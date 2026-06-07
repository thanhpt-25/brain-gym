-- Add REMOVED value to QuestionStatus enum
-- This value marks soft-deleted questions that should no longer appear in public
-- listings or be selectable for future exam sessions.
ALTER TYPE "QuestionStatus" ADD VALUE 'REMOVED';
