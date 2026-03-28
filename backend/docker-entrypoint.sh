#!/bin/sh
set -e

echo "Running database migrations..."

# Resolve any previously failed migrations so deploy can proceed
npx prisma migrate resolve --rolled-back "20260328000002_fix_schema_drift" 2>/dev/null || true

# Attempt migrate deploy; if P3005 (non-empty DB with no migration history), baseline first
if ! deploy_output=$(npx prisma migrate deploy 2>&1); then
  echo "$deploy_output"
  if echo "$deploy_output" | grep -q "P3005"; then
    echo "Detected P3005 — baselining existing migrations..."
    npx prisma migrate resolve --applied "20260308122554_init"
    npx prisma migrate resolve --applied "20260317150938_add_analytics_training"
    npx prisma migrate resolve --applied "20260321032903_flashcards_init"
    npx prisma migrate resolve --applied "20260326144134_add_timer_mode_and_trap_question"
    npx prisma migrate resolve --applied "20260328000000_ai_question_bank"
    npx prisma migrate resolve --applied "20260328000001_add_user_status"
    npx prisma migrate resolve --applied "20260328000002_fix_schema_drift"
    npx prisma migrate resolve --applied "20260328000003_add_question_soft_delete"
    echo "Baseline complete. Running migrate deploy..."
    npx prisma migrate deploy
  else
    exit 1
  fi
else
  echo "$deploy_output"
fi

echo "Seeding database..."
npx ts-node --compiler-options '{"module":"CommonJS"}' --transpile-only prisma/seed.ts

echo "Starting application..."
exec npm run start:prod
