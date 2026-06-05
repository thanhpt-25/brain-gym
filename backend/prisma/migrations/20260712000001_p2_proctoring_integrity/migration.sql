-- P2 Proctoring & Integrity
-- AlterTable: Assessment — add proctoring config fields
ALTER TABLE "assessments"
  ADD COLUMN "require_fullscreen" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "require_otp"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "max_attempts"       INTEGER NOT NULL DEFAULT 1;

-- AlterTable: CandidateInvite — add integrity score + OTP verification timestamp
ALTER TABLE "candidate_invites"
  ADD COLUMN "integrity_score"  INTEGER,
  ADD COLUMN "otp_verified_at"  TIMESTAMP(3);

-- CreateTable: CandidateEvent — proctoring event timeline per invite
CREATE TABLE "candidate_events" (
  "id"         TEXT NOT NULL,
  "invite_id"  TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload"    JSONB NOT NULL DEFAULT '{}',
  "client_ts"  TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "candidate_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidate_events_invite_id_client_ts_idx" ON "candidate_events"("invite_id", "client_ts");

-- AddForeignKey
ALTER TABLE "candidate_events"
  ADD CONSTRAINT "candidate_events_invite_id_fkey"
  FOREIGN KEY ("invite_id") REFERENCES "candidate_invites"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
