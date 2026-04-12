-- AddColumn certification_id to org_questions
ALTER TABLE "public"."org_questions" ADD COLUMN "certification_id" TEXT;

-- AddForeignKey
ALTER TABLE "public"."org_questions" ADD CONSTRAINT "org_questions_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "public"."certifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
