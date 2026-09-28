-- Exam Sprint 3: practice modes (quick drill, full mock, review, adaptive).

-- CreateEnum
CREATE TYPE "PracticeMode" AS ENUM ('STANDARD', 'QUICK_DRILL', 'FULL_MOCK', 'REVIEW', 'ADAPTIVE');

-- AlterTable
ALTER TABLE "exams" ADD COLUMN "practice_mode" "PracticeMode";
