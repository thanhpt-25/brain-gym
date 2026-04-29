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
