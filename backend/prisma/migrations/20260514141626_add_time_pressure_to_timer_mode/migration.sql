/*
  Warnings:

  - You are about to drop the column `provider` on the `certifications` table. All the data in the column will be lost.
  - Made the column `provider_id` on table `certifications` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "TimerMode" ADD VALUE 'TIME_PRESSURE';

-- DropForeignKey
ALTER TABLE "attempt_events" DROP CONSTRAINT "attempt_events_attempt_id_fkey";

-- DropForeignKey
ALTER TABLE "attempt_events" DROP CONSTRAINT "attempt_events_user_id_fkey";

-- DropForeignKey
ALTER TABLE "llm_usage_events" DROP CONSTRAINT "llm_usage_events_user_id_fkey";

-- DropForeignKey
ALTER TABLE "pass_likelihood_surveys" DROP CONSTRAINT "pass_likelihood_surveys_certification_id_fkey";

-- DropForeignKey
ALTER TABLE "pass_likelihood_surveys" DROP CONSTRAINT "pass_likelihood_surveys_user_id_fkey";

-- DropForeignKey
ALTER TABLE "question_generation_jobs" DROP CONSTRAINT "question_generation_jobs_org_id_fkey";

-- DropIndex
DROP INDEX "llm_usage_events_feature_created_at_idx";

-- DropIndex
DROP INDEX "question_generation_jobs_org_id_idx";

-- AlterTable
ALTER TABLE "attempt_events" ALTER COLUMN "client_ts" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "certifications" DROP COLUMN "provider",
ALTER COLUMN "provider_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "pass_likelihood_surveys" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "submitted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "providers" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "flashcard_review_schedules_user_id_next_review_date_idx" ON "flashcard_review_schedules"("user_id", "next_review_date");

-- CreateIndex
CREATE INDEX "flashcard_review_schedules_user_id_mastery_idx" ON "flashcard_review_schedules"("user_id", "mastery");

-- CreateIndex
CREATE INDEX "questions_deleted_at_idx" ON "questions"("deleted_at");

-- CreateIndex
CREATE INDEX "questions_status_idx" ON "questions"("status");

-- CreateIndex
CREATE INDEX "questions_certification_id_status_idx" ON "questions"("certification_id", "status");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- AddForeignKey
ALTER TABLE "question_generation_jobs" ADD CONSTRAINT "question_generation_jobs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_events" ADD CONSTRAINT "attempt_events_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_events" ADD CONSTRAINT "attempt_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_usage_events" ADD CONSTRAINT "llm_usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_likelihood_surveys" ADD CONSTRAINT "pass_likelihood_surveys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_likelihood_surveys" ADD CONSTRAINT "pass_likelihood_surveys_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "certifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "pass_likelihood_surveys_user_cert_unique" RENAME TO "pass_likelihood_surveys_user_id_certification_id_key";
