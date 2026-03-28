-- CreateEnum
CREATE TYPE "LlmProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI');

-- CreateEnum
CREATE TYPE "GenerationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "QualityTier" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "MaterialContentType" AS ENUM ('PDF', 'URL', 'TEXT');

-- AlterTable: add AI-generation fields to questions
ALTER TABLE "questions"
  ADD COLUMN "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "generation_job_id" TEXT,
  ADD COLUMN "quality_tier" "QualityTier",
  ADD COLUMN "source_chunk_id" TEXT;

-- CreateTable: user_llm_configs
CREATE TABLE "user_llm_configs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "LlmProvider" NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "model_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_llm_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: source_materials
CREATE TABLE "source_materials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "certification_id" TEXT,
    "title" TEXT NOT NULL,
    "original_filename" TEXT,
    "content_type" "MaterialContentType" NOT NULL,
    "source_url" TEXT,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable: source_chunks
CREATE TABLE "source_chunks" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "page_number" INTEGER,
    "section_title" TEXT,
    "token_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: question_generation_jobs
CREATE TABLE "question_generation_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "certification_id" TEXT NOT NULL,
    "domain_id" TEXT,
    "material_id" TEXT,
    "provider" "LlmProvider" NOT NULL,
    "model_id" TEXT,
    "difficulty" "Difficulty" NOT NULL,
    "question_count" INTEGER NOT NULL,
    "status" "GenerationJobStatus" NOT NULL DEFAULT 'PENDING',
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "quality_scores" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "question_generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_llm_configs_user_id_provider_key" ON "user_llm_configs"("user_id", "provider");

-- AddForeignKey: user_llm_configs -> users
ALTER TABLE "user_llm_configs" ADD CONSTRAINT "user_llm_configs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: source_materials -> users
ALTER TABLE "source_materials" ADD CONSTRAINT "source_materials_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: source_materials -> certifications
ALTER TABLE "source_materials" ADD CONSTRAINT "source_materials_certification_id_fkey"
  FOREIGN KEY ("certification_id") REFERENCES "certifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: source_chunks -> source_materials
ALTER TABLE "source_chunks" ADD CONSTRAINT "source_chunks_material_id_fkey"
  FOREIGN KEY ("material_id") REFERENCES "source_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: question_generation_jobs -> users
ALTER TABLE "question_generation_jobs" ADD CONSTRAINT "question_generation_jobs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: question_generation_jobs -> certifications
ALTER TABLE "question_generation_jobs" ADD CONSTRAINT "question_generation_jobs_certification_id_fkey"
  FOREIGN KEY ("certification_id") REFERENCES "certifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: question_generation_jobs -> domains
ALTER TABLE "question_generation_jobs" ADD CONSTRAINT "question_generation_jobs_domain_id_fkey"
  FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: question_generation_jobs -> source_materials
ALTER TABLE "question_generation_jobs" ADD CONSTRAINT "question_generation_jobs_material_id_fkey"
  FOREIGN KEY ("material_id") REFERENCES "source_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: questions.generation_job_id -> question_generation_jobs
ALTER TABLE "questions" ADD CONSTRAINT "questions_generation_job_id_fkey"
  FOREIGN KEY ("generation_job_id") REFERENCES "question_generation_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: questions.source_chunk_id -> source_chunks
ALTER TABLE "questions" ADD CONSTRAINT "questions_source_chunk_id_fkey"
  FOREIGN KEY ("source_chunk_id") REFERENCES "source_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
