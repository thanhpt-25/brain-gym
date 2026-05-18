/*
  Warnings:

  - The primary key for the `moderation_audits` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "moderation_audits" DROP CONSTRAINT "moderation_audits_question_id_fkey";

-- DropForeignKey
ALTER TABLE "moderation_audits" DROP CONSTRAINT "moderation_audits_reviewer_id_fkey";

-- DropForeignKey
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_certification_id_fkey";

-- DropIndex
DROP INDEX "organizations_kind_certification_id_idx";

-- AlterTable
ALTER TABLE "llm_usage_events" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "moderation_audits" DROP CONSTRAINT "moderation_audits_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "moderation_audits_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "target_exam_date" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferences" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "subscription_tier" TEXT NOT NULL DEFAULT 'free';

-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "exam_id" TEXT,
    "org_id" TEXT NOT NULL,
    "passageMarkdown" TEXT NOT NULL,
    "diagram_url" TEXT,
    "time_limit" INTEGER NOT NULL DEFAULT 900,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_questions" (
    "id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenario_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "score" INTEGER DEFAULT 0,
    "reasoning_trace" TEXT,

    CONSTRAINT "scenario_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'active',
    "messages" JSONB NOT NULL,
    "cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scenarios_exam_id_idx" ON "scenarios"("exam_id");

-- CreateIndex
CREATE INDEX "scenarios_org_id_idx" ON "scenarios"("org_id");

-- CreateIndex
CREATE INDEX "scenario_questions_scenario_id_order_idx" ON "scenario_questions"("scenario_id", "order");

-- CreateIndex
CREATE INDEX "scenario_questions_question_id_idx" ON "scenario_questions"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_questions_scenario_id_question_id_key" ON "scenario_questions"("scenario_id", "question_id");

-- CreateIndex
CREATE INDEX "scenario_attempts_user_id_scenario_id_idx" ON "scenario_attempts"("user_id", "scenario_id");

-- CreateIndex
CREATE INDEX "scenario_attempts_user_id_attempted_at_idx" ON "scenario_attempts"("user_id", "attempted_at");

-- CreateIndex
CREATE INDEX "scenario_attempts_scenario_id_idx" ON "scenario_attempts"("scenario_id");

-- CreateIndex
CREATE INDEX "coach_sessions_user_id_created_at_idx" ON "coach_sessions"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "certifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_audits" ADD CONSTRAINT "moderation_audits_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_audits" ADD CONSTRAINT "moderation_audits_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_questions" ADD CONSTRAINT "scenario_questions_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_questions" ADD CONSTRAINT "scenario_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_attempts" ADD CONSTRAINT "scenario_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_attempts" ADD CONSTRAINT "scenario_attempts_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_sessions" ADD CONSTRAINT "coach_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "behavioral_insights_user_cert_kind_for_key" RENAME TO "behavioral_insights_user_id_certification_id_kind_generated_key";
