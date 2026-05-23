/*
  Warnings:

  - Made the column `provider_id` on table `certifications` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "certifications"
ALTER COLUMN "provider_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "providers" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "question_generation_jobs" ADD COLUMN     "preview_data" JSONB;

-- CreateTable
CREATE TABLE "attempt_events" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question_id" TEXT,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "client_ts" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attempt_events_attempt_id_idx" ON "attempt_events"("attempt_id");

-- CreateIndex
CREATE INDEX "attempt_events_user_id_created_at_idx" ON "attempt_events"("user_id", "created_at");

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
ALTER TABLE "attempt_events" ADD CONSTRAINT "attempt_events_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_events" ADD CONSTRAINT "attempt_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
