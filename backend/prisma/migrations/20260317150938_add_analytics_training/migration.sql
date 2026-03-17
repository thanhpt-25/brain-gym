-- CreateEnum
CREATE TYPE "MistakeType" AS ENUM ('CONCEPT', 'CARELESS', 'TRAP', 'TIME_PRESSURE');

-- AlterTable
ALTER TABLE "answers" ADD COLUMN     "mistake_type" "MistakeType";

-- CreateTable
CREATE TABLE "review_schedules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "next_review_date" TIMESTAMP(3) NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "ease_factor" DECIMAL(4,2) NOT NULL DEFAULT 2.50,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_schedules_user_id_question_id_key" ON "review_schedules"("user_id", "question_id");

-- AddForeignKey
ALTER TABLE "review_schedules" ADD CONSTRAINT "review_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_schedules" ADD CONSTRAINT "review_schedules_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
