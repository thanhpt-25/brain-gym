/*
  Warnings:

  - Made the column `provider_id` on table `certifications` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "TimerMode" ADD VALUE 'TIME_PRESSURE';

-- AlterTable
ALTER TABLE "certifications" ALTER COLUMN "provider_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "pass_likelihood_surveys" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "submitted_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "providers" ALTER COLUMN "updated_at" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "pass_likelihood_surveys_user_cert_unique" RENAME TO "pass_likelihood_surveys_user_id_certification_id_key";
