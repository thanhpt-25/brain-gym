-- CreateEnum
CREATE TYPE "AssessmentSelectionMode" AS ENUM ('MANUAL', 'BLUEPRINT', 'POOL');

-- AlterTable: Assessment — add selection_mode and selection_config
ALTER TABLE "assessments"
  ADD COLUMN "selection_mode" "AssessmentSelectionMode" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "selection_config" JSONB;

-- AlterTable: CandidateInvite — add drawn_question_ids for POOL mode snapshot
ALTER TABLE "candidate_invites"
  ADD COLUMN "drawn_question_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
