-- US-405: Add attempt_events table for exam session event tracking
-- Captures user interactions during exam attempts: page views, question submissions, timer events

CREATE TABLE "attempt_events" (
  "id"            TEXT PRIMARY KEY,
  "attempt_id"    TEXT NOT NULL,
  "user_id"       TEXT NOT NULL,
  "question_id"   TEXT,
  "event_type"    TEXT NOT NULL,
  "payload"       JSONB NOT NULL,
  "client_ts"     TIMESTAMPTZ NOT NULL,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "attempt_events_attempt_id_fkey"
    FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE,
  CONSTRAINT "attempt_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

-- Index for efficient lookup by attempt
CREATE INDEX "attempt_events_attempt_id_idx" ON "attempt_events"("attempt_id");

-- Index for user activity queries with timestamp filtering
CREATE INDEX "attempt_events_user_id_created_at_idx" ON "attempt_events"("user_id", "created_at");
