-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PREMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER');

-- CreateEnum
CREATE TYPE "OrgInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CandidateAttemptStatus" AS ENUM ('INVITED', 'STARTED', 'SUBMITTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ExamCatalogItemType" AS ENUM ('FIXED', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "OrgQuestionStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "description" TEXT,
    "industry" TEXT,
    "accent_color" TEXT,
    "max_seats" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_members" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "group_id" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "org_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_groups" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_invites" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" "OrgInviteStatus" NOT NULL DEFAULT 'PENDING',
    "invited_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_join_links" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "max_uses" INTEGER,
    "current_uses" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_join_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_questions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "source_question_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "question_type" "QuestionType" NOT NULL DEFAULT 'SINGLE',
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "explanation" TEXT,
    "reference_url" TEXT,
    "code_snippet" TEXT,
    "is_scenario" BOOLEAN NOT NULL DEFAULT false,
    "is_trap_question" BOOLEAN NOT NULL DEFAULT false,
    "status" "OrgQuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_question_choices" (
    "id" TEXT NOT NULL,
    "org_question_id" TEXT NOT NULL,
    "label" CHAR(1) NOT NULL,
    "content" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "org_question_choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_tracks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_catalog_items" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ExamCatalogItemType" NOT NULL DEFAULT 'FIXED',
    "certification_id" TEXT,
    "question_count" INTEGER NOT NULL,
    "time_limit" INTEGER NOT NULL,
    "passing_score" INTEGER,
    "timer_mode" "TimerMode" NOT NULL DEFAULT 'STRICT',
    "max_attempts" INTEGER,
    "available_from" TIMESTAMP(3),
    "available_until" TIMESTAMP(3),
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "track_id" TEXT,
    "prerequisite_id" TEXT,
    "created_by" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_catalog_questions" (
    "id" TEXT NOT NULL,
    "catalog_item_id" TEXT NOT NULL,
    "org_question_id" TEXT,
    "public_question_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "exam_catalog_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_exam_assignments" (
    "id" TEXT NOT NULL,
    "catalog_item_id" TEXT NOT NULL,
    "group_id" TEXT,
    "member_id" TEXT,
    "due_date" TIMESTAMP(3),
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_exam_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "question_count" INTEGER NOT NULL,
    "time_limit" INTEGER NOT NULL,
    "passing_score" INTEGER,
    "randomize_questions" BOOLEAN NOT NULL DEFAULT true,
    "randomize_choices" BOOLEAN NOT NULL DEFAULT true,
    "detect_tab_switch" BOOLEAN NOT NULL DEFAULT false,
    "block_copy_paste" BOOLEAN NOT NULL DEFAULT false,
    "link_expiry_hours" INTEGER NOT NULL DEFAULT 72,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_invites" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "candidate_email" TEXT NOT NULL,
    "candidate_name" TEXT,
    "token" TEXT NOT NULL,
    "status" "CandidateAttemptStatus" NOT NULL DEFAULT 'INVITED',
    "score" DECIMAL(5,2),
    "total_correct" INTEGER,
    "total_questions" INTEGER,
    "domain_scores" JSONB,
    "time_spent" INTEGER,
    "tab_switch_count" INTEGER,
    "ip_address" TEXT,
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_answers" (
    "id" TEXT NOT NULL,
    "invite_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "selected_choices" TEXT[],
    "is_correct" BOOLEAN,
    "time_spent" INTEGER,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "org_members_org_id_user_id_key" ON "org_members"("org_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_invites_token_key" ON "org_invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "org_join_links_code_key" ON "org_join_links"("code");

-- CreateIndex
CREATE INDEX "org_questions_org_id_status_idx" ON "org_questions"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_invites_token_key" ON "candidate_invites"("token");

-- AlterTable
ALTER TABLE "users" ADD COLUMN "plan" "UserPlan" NOT NULL DEFAULT 'FREE';

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "org_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_groups" ADD CONSTRAINT "org_groups_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_join_links" ADD CONSTRAINT "org_join_links_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_questions" ADD CONSTRAINT "org_questions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_question_choices" ADD CONSTRAINT "org_question_choices_org_question_id_fkey" FOREIGN KEY ("org_question_id") REFERENCES "org_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_tracks" ADD CONSTRAINT "learning_tracks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_catalog_items" ADD CONSTRAINT "exam_catalog_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_catalog_items" ADD CONSTRAINT "exam_catalog_items_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "certifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_catalog_items" ADD CONSTRAINT "exam_catalog_items_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "learning_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_catalog_items" ADD CONSTRAINT "exam_catalog_items_prerequisite_id_fkey" FOREIGN KEY ("prerequisite_id") REFERENCES "exam_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_catalog_questions" ADD CONSTRAINT "exam_catalog_questions_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "exam_catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_catalog_questions" ADD CONSTRAINT "exam_catalog_questions_org_question_id_fkey" FOREIGN KEY ("org_question_id") REFERENCES "org_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_catalog_questions" ADD CONSTRAINT "exam_catalog_questions_public_question_id_fkey" FOREIGN KEY ("public_question_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_exam_assignments" ADD CONSTRAINT "org_exam_assignments_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "exam_catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_exam_assignments" ADD CONSTRAINT "org_exam_assignments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "org_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_invites" ADD CONSTRAINT "candidate_invites_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_answers" ADD CONSTRAINT "candidate_answers_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "candidate_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
