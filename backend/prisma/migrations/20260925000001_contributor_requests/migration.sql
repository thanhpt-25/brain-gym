-- Learner → CONTRIBUTOR role requests reviewed by admins
-- (docs/specs/contributor-role-request-srs.md).

-- CreateEnum
CREATE TYPE "ContributorRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "contributor_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "ContributorRequestStatus" NOT NULL DEFAULT 'PENDING',
    "motivation" TEXT NOT NULL,
    "expertise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sample_url" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "decision_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributor_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contributor_requests_status_created_at_idx" ON "contributor_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "contributor_requests_user_id_created_at_idx" ON "contributor_requests"("user_id", "created_at");

-- At most one PENDING request per user (not expressible in Prisma schema).
CREATE UNIQUE INDEX "contributor_requests_one_pending_per_user" ON "contributor_requests"("user_id") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "contributor_requests" ADD CONSTRAINT "contributor_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_requests" ADD CONSTRAINT "contributor_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
