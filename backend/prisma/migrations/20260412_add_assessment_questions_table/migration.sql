-- CreateTable: assessment_questions (missing from enterprise_plan migration)
CREATE TABLE "public"."assessment_questions" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "org_question_id" TEXT,
    "public_question_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."assessment_questions" ADD CONSTRAINT "assessment_questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assessment_questions" ADD CONSTRAINT "assessment_questions_org_question_id_fkey" FOREIGN KEY ("org_question_id") REFERENCES "public"."org_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assessment_questions" ADD CONSTRAINT "assessment_questions_public_question_id_fkey" FOREIGN KEY ("public_question_id") REFERENCES "public"."questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
