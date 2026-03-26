-- CreateEnum
CREATE TYPE "TimerMode" AS ENUM ('STRICT', 'ACCELERATED', 'RELAXED');

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "timer_mode" "TimerMode" NOT NULL DEFAULT 'STRICT';

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "is_trap_question" BOOLEAN NOT NULL DEFAULT false;
