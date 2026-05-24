# On-Call Runbook — CertGym

## Rotation

Sprint 1: [FE Senior] (FE) + [BE Senior] (BE) — tuan 1
Sprint 2: [FE Mid] (FE) + [BE Mid] (BE) — tuan 2

## Escalation

1. On-call engineer check alert trong #certgym-incidents
2. Neu khong giai quyet trong 15 phut → ping SM
3. SM ping Tech Lead neu architectural issue

## Deploy Rollback

```bash
# FE rollback (Nginx serving static)
git revert HEAD --no-edit
git push origin main
# CI se build + deploy lai tu dong

# BE rollback
cd backend
git revert HEAD --no-edit
git push origin main
# Hoac rollback migration:
npx prisma migrate resolve --rolled-back <migration_name>
```

## Log Access

```bash
# Docker logs
docker-compose logs -f backend
docker-compose logs -f nginx

# DB queries
docker-compose exec db psql -U postgres -d braingym
```

## Common Incidents

### API 503 (backend down)

1. `docker-compose ps` — check container status
2. `docker-compose restart backend`
3. Check logs: `docker-compose logs backend --tail=50`

### DB connection failed

1. `docker-compose ps db` — check postgres
2. `docker-compose restart db && docker-compose restart backend`
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

### DDS Canary Rollback Rate High

**Alert:** `DDSCanaryRollbackRateHigh`  
**Severity:** CRITICAL  
**Threshold:** Rollback rate ≥ 10% (5-minute window)  
**Reference:** ADR-026, `backend/monitoring/alert-rules-sprint11.yml`

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

**If rate > 5%:** Review flags (ADR-027) to see if velocity-burst (≥5 votes, 10s) or vote-ring (3+ votes, 60s) thresholds need tuning.

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
