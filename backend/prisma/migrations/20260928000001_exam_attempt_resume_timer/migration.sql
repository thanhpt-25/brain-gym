-- Exam Sprint 1: server-authoritative timer + resumable attempts.

-- AlterTable
ALTER TABLE "exam_attempts" ADD COLUMN "expires_at" TIMESTAMP(3),
ADD COLUMN "presentation" JSONB;

-- CreateIndex
CREATE INDEX "exam_attempts_user_id_status_idx" ON "exam_attempts"("user_id", "status");
