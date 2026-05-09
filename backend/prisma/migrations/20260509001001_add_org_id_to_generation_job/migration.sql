-- Add org_id column to question_generation_jobs for RFC-012 cost attribution
ALTER TABLE "public"."question_generation_jobs" ADD COLUMN "org_id" TEXT;

-- Add foreign key constraint to organizations
ALTER TABLE "public"."question_generation_jobs" ADD CONSTRAINT "question_generation_jobs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations" ("id") ON DELETE SET NULL;

-- Add index for org-level cost queries
CREATE INDEX "question_generation_jobs_org_id_idx" ON "public"."question_generation_jobs" ("org_id");
