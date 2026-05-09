-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('STANDARD', 'TIME_PRESSURE');

-- AlterTable
ALTER TABLE "exam_attempts" ADD COLUMN "exam_type" "ExamType" NOT NULL DEFAULT 'STANDARD';
