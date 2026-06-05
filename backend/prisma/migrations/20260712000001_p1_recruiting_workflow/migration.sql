-- P1: Recruiting Workflow (ATS-lite)

-- AlterEnum: OrgRole — add RECRUITER
ALTER TYPE "OrgRole" ADD VALUE 'RECRUITER';

-- CreateEnum: CandidateStage
CREATE TYPE "CandidateStage" AS ENUM ('APPLIED', 'SCREENING', 'SHORTLISTED', 'REJECTED', 'HIRED');

-- CreateTable: JobRole
CREATE TABLE "job_roles" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_roles_org_id_idx" ON "job_roles"("org_id");

-- AddForeignKey
ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Assessment — add job_role_id
ALTER TABLE "assessments"
    ADD COLUMN "job_role_id" TEXT;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: CandidateInvite — add ATS fields
ALTER TABLE "candidate_invites"
    ADD COLUMN "stage" "CandidateStage" NOT NULL DEFAULT 'APPLIED',
    ADD COLUMN "rating" INTEGER,
    ADD COLUMN "recruiter_note" TEXT,
    ADD COLUMN "decided_by" TEXT,
    ADD COLUMN "decided_at" TIMESTAMP(3);
