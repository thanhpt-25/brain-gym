-- CreateEnum
CREATE TYPE "CompetencyDomainSource" AS ENUM ('ORG_QUESTION_CATEGORY', 'PUBLIC_DOMAIN');

-- CreateTable: competencies
CREATE TABLE "competencies" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scale_min" INTEGER NOT NULL DEFAULT 1,
    "scale_max" INTEGER NOT NULL DEFAULT 5,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable: competency_domains
CREATE TABLE "competency_domains" (
    "id" TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "domain_name" VARCHAR(200) NOT NULL,
    "source" "CompetencyDomainSource" NOT NULL DEFAULT 'ORG_QUESTION_CATEGORY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable: question_competencies
CREATE TABLE "question_competencies" (
    "id" TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "org_question_id" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable: job_role_competencies
CREATE TABLE "job_role_competencies" (
    "id" TEXT NOT NULL,
    "job_role_id" TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "required_level" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_role_competencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competencies_org_id_idx" ON "competencies"("org_id");
CREATE UNIQUE INDEX "competencies_org_id_name_key" ON "competencies"("org_id", "name");

-- CreateIndex
CREATE INDEX "competency_domains_competency_id_idx" ON "competency_domains"("competency_id");
CREATE UNIQUE INDEX "competency_domains_competency_id_source_domain_name_key" ON "competency_domains"("competency_id", "source", "domain_name");

-- CreateIndex
CREATE INDEX "question_competencies_org_question_id_idx" ON "question_competencies"("org_question_id");
CREATE UNIQUE INDEX "question_competencies_competency_id_org_question_id_key" ON "question_competencies"("competency_id", "org_question_id");

-- CreateIndex
CREATE INDEX "job_role_competencies_competency_id_idx" ON "job_role_competencies"("competency_id");
CREATE UNIQUE INDEX "job_role_competencies_job_role_id_competency_id_key" ON "job_role_competencies"("job_role_id", "competency_id");

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_domains" ADD CONSTRAINT "competency_domains_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_competencies" ADD CONSTRAINT "question_competencies_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "question_competencies" ADD CONSTRAINT "question_competencies_org_question_id_fkey" FOREIGN KEY ("org_question_id") REFERENCES "org_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_role_competencies" ADD CONSTRAINT "job_role_competencies_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_role_competencies" ADD CONSTRAINT "job_role_competencies_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
