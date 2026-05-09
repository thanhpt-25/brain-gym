-- RFC-012 Phase-0: LLM Usage Events Ledger
-- Tracks every LLM API call for cost attribution, quota enforcement, and observability

-- Create llm_usage_events table
CREATE TABLE "public"."llm_usage_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT,
    "feature" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DECIMAL(10,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "llm_usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE CASCADE
);

-- Index for per-user cost history queries (e.g., user's monthly usage)
CREATE INDEX "llm_usage_events_user_id_created_at_idx" ON "public"."llm_usage_events" ("user_id", "created_at");

-- Index for per-org quota enforcement queries (e.g., daily org spending)
CREATE INDEX "llm_usage_events_org_id_created_at_idx" ON "public"."llm_usage_events" ("org_id", "created_at");

-- Index for feature breakdown queries (e.g., cost per feature)
CREATE INDEX "llm_usage_events_feature_created_at_idx" ON "public"."llm_usage_events" ("feature", "created_at");
