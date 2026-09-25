-- Exam interactive mode: per-question feedback + explanation
-- (docs/specs/exam-interactive-mode-srs.md).

-- CreateEnum
CREATE TYPE "FeedbackMode" AS ENUM ('END_OF_EXAM', 'INTERACTIVE');

-- AlterTable
ALTER TABLE "exam_attempts" ADD COLUMN "feedback_mode" "FeedbackMode" NOT NULL DEFAULT 'END_OF_EXAM';

-- AlterTable
ALTER TABLE "answers" ADD COLUMN "checked_at" TIMESTAMP(3);
