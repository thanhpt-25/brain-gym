# On-Call Runbook — CertGym

## Rotation

Sprint 1: [FE Senior] (FE) + [BE Senior] (BE) — week 1
Sprint 2: [FE Mid] (FE) + [BE Mid] (BE) — week 2

## Escalation

1. On-call engineer checks alert in #certgym-incidents
2. If not resolved within 15 minutes, ping SM
3. SM pings Tech Lead for architectural issues

## Deploy Rollback

The production deployment pipeline is GitHub Actions (`.github/workflows/deploy.yml`).

**Backend rollback** — re-deploy the previous image revision in ECS:

```bash
# Identify the previous task definition revision from ECS console or CLI
aws ecs describe-services \
  --cluster braingym-production \
  --services braingym-backend \
  --query 'services[0].taskDefinition'

# Roll back by deploying the previous revision
aws ecs update-service \
  --cluster braingym-production \
  --service braingym-backend \
  --task-definition braingym-backend:<PREVIOUS_REVISION>
```

**Database migration rollback:**

```bash
cd backend
npx prisma migrate resolve --rolled-back <migration_name>
```

**Frontend rollback** — re-sync the previous build artifact to S3:

```bash
# Trigger a workflow_dispatch for the previous SHA from GitHub Actions UI,
# or manually sync a previous dist/ artifact to S3 and invalidate CloudFront.
aws cloudfront create-invalidation \
  --distribution-id $AWS_CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*"
```

## Log Access

```bash
# Docker logs (local / staging docker-compose stack)
docker-compose logs -f backend
docker-compose logs -f nginx

# DB access (service name is "postgres")
docker-compose exec postgres psql -U braingym -d braingym
```

## Common Incidents

### API 503 (backend down)

1. `docker-compose ps` — check container status
2. `docker-compose restart backend`
3. Check logs: `docker-compose logs backend --tail=50`

### DB connection failed

1. `docker-compose ps postgres` — check postgres container
2. `docker-compose restart postgres && docker-compose restart backend`
3. Verify `DATABASE_URL` env var

### LLM quota exceeded

1. Check `#certgym-incidents` for cost alert
2. Set `AI_GENERATION_ENABLED=false` in env
3. Notify PO — impact: AI question generation disabled

### High API latency

1. Check Redis: `docker-compose exec redis redis-cli PING`
2. Check active DB queries: `SELECT * FROM pg_stat_activity WHERE state='active';`
3. Check if Prisma connection pool exhausted

---

## Sprint 11+ Alerts

### DDS Canary Rollback Rate High (US-1109)

**Alert:** `DDSCanaryRollbackRateHigh`
**Severity:** CRITICAL
**Threshold:** Rollback rate > 5% (10-minute window)
**Grace Period:** 2 minutes (alert fires after sustained threshold breach)
**Reference:** US-1109, ADR-026, `backend/monitoring/alert-rules-sprint11.yml`
**Behavior:** Canary auto-pause already implemented in `backend/src/ai-question-bank/dds/dds.service.ts` (US-1101)

#### Response (First 5 Minutes)

1. Open Grafana: `http://grafana.local/d/sprint11-observability`
2. Check "DDS Rollback Rate (5-min window)" panel
3. Verify it's actually >10% (rule has 2m grace period)
4. Check if canary is already paused:
   ```sql
   SELECT is_armed, paused_at, paused_reason FROM DdsConfig WHERE cohort = 'beta-rewriters';
   ```

#### Root Cause Investigation

```sql
-- Recent rollbacks
SELECT id, variant_id, rolled_back_at, rollback_reason FROM DdsVariant
WHERE status='ROLLED_BACK' AND rolled_back_at > NOW()-INTERVAL '10 min'
ORDER BY rolled_back_at DESC LIMIT 10;

-- Rollback distribution by reason
SELECT rollback_reason, COUNT(*) FROM DdsVariant
WHERE status='ROLLED_BACK' AND rolled_back_at > NOW()-INTERVAL '10 min'
GROUP BY rollback_reason;

-- Current stats
SELECT
  COUNT(*) FILTER (WHERE status='ROLLED_BACK') as rollbacks,
  COUNT(*) FILTER (WHERE status='APPROVED') as approved,
  COUNT(*) FILTER (WHERE status='AUTO_APPLIED') as auto_applied
FROM DdsVariant WHERE created_at > NOW()-INTERVAL '15 min';
```

#### Mitigation

If >10% sustained for >5 minutes, **pause the canary:**

```bash
# POST /admin/dds/canary/pause
curl -X POST http://backend:3000/admin/dds/canary/pause \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason":"Rollback spike investigation"}'
```

**Create P1 ticket:** Include dashboard link, sample rollback query results, root cause hypothesis.

#### Resume (After Fix)

```bash
# POST /admin/dds/canary/resume
curl -X POST http://backend:3000/admin/dds/canary/resume \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason":"Issue resolved - [cause]"}'
```

---

### Reputation Anti-Gaming Flag Rate

**Alert:** `ReputationFlagCreationRate`
**Severity:** INFO
**Threshold:** >5% of votes flagged (1-hour window)

#### Quick Check

```sql
-- What's being flagged?
SELECT flag_reason, COUNT(*) as count
FROM ReputationFlag
WHERE created_at > NOW()-INTERVAL '1 hour'
GROUP BY flag_reason ORDER BY count DESC;

-- Users with multiple flags
SELECT user_id, COUNT(*) as flag_count
FROM ReputationFlag
WHERE created_at > NOW()-INTERVAL '1 hour'
GROUP BY user_id HAVING COUNT(*) >= 3;
```

**If rate > 5%:** Review flags (ADR-027) to see if velocity-burst (>=5 votes, 10s) or vote-ring (3+ votes, 60s) thresholds need tuning.

---

### KG Recompute Failure Rate

**Alert:** `KGOverlapRecomputeFailureRate`
**Severity:** WARNING
**Threshold:** >5% of jobs failing (1-hour window)

#### Diagnostics

```bash
# Queue status
curl http://backend:3000/admin/queue/overlap-recompute/status

# Elasticsearch health
curl http://elasticsearch:9200/_cluster/health
```

```sql
-- Failure reasons
SELECT error_message, COUNT(*)
FROM KGOverlapRecomputeJob
WHERE status='FAILED' AND created_at > NOW()-INTERVAL '1 hour'
GROUP BY error_message ORDER BY count DESC;
```

**Common Fixes:**

- Restart Elasticsearch if connectivity issues
- Check vector DB indices exist
- Scale job workers if queue backed up

---

### KG Recompute Latency High

**Alert:** `KGOverlapRecomputeDurationHigh`
**Severity:** WARNING
**Threshold:** p95 duration > 500ms

```sql
-- Timing distribution
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95,
  MAX(duration_ms) as max_duration
FROM KGOverlapRecomputeJob
WHERE completed_at > NOW()-INTERVAL '1 hour' AND status='COMPLETED';
```

**Actions:**

- Monitor CPU/memory/disk utilization
- Check for slow Elasticsearch queries
- If sustained >5m, file optimization ticket
