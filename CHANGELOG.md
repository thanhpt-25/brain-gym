# Changelog

All notable changes to CertGym are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0-rc] - 2026-07-04

### New Features

#### DDS (Diverse Dataset System) Auto-Apply GA

- **Shadow Mode Launch**: DDS auto-apply engine now in shadow mode for `beta-rewriters` cohort
  - Proposals generated automatically from variant pool
  - Approvals ranked by consensus score
  - Auto-apply execution in shadow (read-only, for metrics collection)
  - Gate 2 promotion decision based on clean approval count (≥30) + zero correctness violations
  - Canary safety mechanism: rollback-rate threshold 10% over 5-minute window
- **Admin Controls**: New `/admin/dds/auto-apply` UI panel with readiness status indicator
  - Clean approval count progress bar (current/30 target)
  - Last rollback timestamp and rollback count
  - Promote button (enabled only when ready)
  - Manual pause/resume for canary (admin API)

#### Reputation Anti-Gaming System

- **Fraud Detection**: Automatic flag creation for suspicious voting patterns
  - Velocity-burst detection: ≥5 votes on same question within 10s window → flagged
  - Vote-ring detection: 3+ votes on user within 60s window → flagged
  - Held-points mechanism: flagged votes held until review (don't affect leaderboard immediately)
- **Admin Flag Review UI**: `/admin/reputation-flags` with bulk clear/confirm operations
  - Flag reason categorization (velocity-burst vs. vote-ring vs. anomaly)
  - User history inspection
  - False-positive detection metrics
- **Leaderboard Impact**: Points held (not released) until flags are reviewed or expired
  - Improves trust in reputation system
  - Visible to users in leaderboard ("X points on hold")

#### Knowledge Graph Real-Time Recompute

- **Debounced Recomputation**: Question domain edits trigger KG overlap recompute
  - Rapid edits (3+ within 10s) batched into single job
  - Job enqueued to Bull queue, processed by workers
  - Completes within 500ms (p95 target)
- **Study-Plan Scheduling**: First iteration of adaptive scheduling
  - Only for "must-learn" domain clusters
  - Distributes must-learn questions across available study window
  - Respects spaced-repetition decay

### Improvements

- **Observability**: Grafana dashboard with 8 panels covering DDS, anti-gaming, and KG metrics
  - Real-time rollback-rate visualization with threshold indicators
  - Flag creation/confirmation/false-positive metrics
  - KG recompute duration and failure rate tracking
  - Canary auto-pause event tracking
- **On-Call Runbook**: Comprehensive incident response procedures
  - DDS canary rollback-rate high: investigation queries and mitigation steps
  - Reputation flag volume spike: diagnostic queries and threshold tuning guidance
  - KG recompute failures: queue status checks and remediation steps
  - Contact/escalation procedures updated

- **Database Indexing**: IVFFlat vector index prepared for KG queries (deferred to S12)
  - Migration ready for ≥10k vectors
  - Placeholder index (`hnsw` algorithm) in place for row count <10k
  - Transparent upgrade path for S12 GA

- **Performance**: API response time targets met
  - DDS endpoints (propose/approve/reject/auto-apply): p95 <300ms
  - Reputation endpoints (vote/flag-review): p95 <250ms
  - KG overlap query: p95 <500ms (exact scan; <200ms once IVFFlat active)

### Known Limitations

- **DDS Auto-Apply**: Cohort-gated to `beta-rewriters` and `beta-explorers` only
  - Shadow mode enforced (auto-apply doesn't flip to live unless Gate 2 approved + manually promoted)
  - Canary window: 5 minutes, rollback threshold: 10%
  - Requires ≥30 clean approvals and zero correctness violations to promote to live

- **Study-Plan Scheduling**: Limited to must-learn domain clusters
  - Advanced scheduling (interleaved practice, cognitive load balancing) deferred to S12
  - Exam-mode scheduling not yet integrated

- **KG Vector Index**: Still using exact `hnsw` algorithm
  - IVFFlat index ready (S12 activation once row count ≥10k)
  - No performance degradation at current scale (<10k vectors)

### Security

- **Prompt Injection Regression**: Comprehensive test coverage (35+ cases)
  - DDS variant prompt injection vectors verified safe
  - Coach LLM safety boundary verified (role-escape, context confusion detection)
  - Message history poisoning prevention (20-message max limit)
  - Response encoding bypass prevention (Base64, ROT13, mixed encoding)

- **Dependency Security**: All dependencies audited
  - No CRITICAL or HIGH vulnerabilities
  - Regular security update schedule established

### Migration & Breaking Changes

**No breaking changes** in v2.0.0-rc. All API endpoints remain backward-compatible with v2.0.0-beta.

#### Database Migrations

```bash
# Apply migrations
npx prisma migrate deploy

# Migrations in this release:
# - ReputationFlag table creation (anti-gaming flags)
# - DdsConfig columns (canary state tracking) [if applicable]
# - IVFFlat index migration (conditional, awaits row threshold)
```

#### Environment Variables (New)

```
DDS_AUTO_APPLY_ENABLED=true          # Feature kill-switch
DDS_SHADOW_MODE=true                  # Cohort-specific default
CANARY_WINDOW_MS=300000               # 5 minutes
CANARY_ROLLBACK_THRESHOLD=0.10        # 10% threshold
REPUTATION_ANOMALY_ENABLED=true       # Anti-gaming system
KG_RECOMPUTE_DEBOUNCE_MS=5000        # Batch window
```

#### Rollback Procedure

```bash
# If issues arise, roll back to v2.0.0-beta
git checkout v2.0.0-beta
npx prisma migrate resolve --rolled-back <migration_name>
docker-compose up -d --build
```

Estimated rollback time: <15 minutes.

---

## [2.0.0-beta] - 2026-04-15

### New Features

- Initial beta release with core features:
  - Spaced-repetition flashcard engine
  - Adaptive exam mode with domain breakdown
  - Organizations & multi-tenant support
  - AI question generation (Claude API integration)
  - Admin audit logs & moderation

### Security

- JWT-based authentication
- Role-based access control (RBAC)
- Input validation & sanitization
- SQL injection prevention (Prisma ORM)

---

## Upgrade Guide

### From v2.0.0-beta to v2.0.0-rc

#### Prerequisites

- Node.js ≥16.9.0
- PostgreSQL 16
- Redis 7

#### Steps

1. **Update environment variables**

   ```bash
   # Add new variables to .env and deployment config
   export DDS_AUTO_APPLY_ENABLED=true
   export DDS_SHADOW_MODE=true
   export CANARY_WINDOW_MS=300000
   export CANARY_ROLLBACK_THRESHOLD=0.10
   export REPUTATION_ANOMALY_ENABLED=true
   ```

2. **Backup database**

   ```bash
   pg_dump brain_gym > backup_2026-07-04.sql
   ```

3. **Run migrations**

   ```bash
   cd backend
   npx prisma migrate deploy
   ```

4. **Deploy application**

   ```bash
   # If using Docker
   docker-compose down
   docker-compose up -d --build

   # If using standalone NestJS
   npm run build
   npm run start:prod
   ```

5. **Verify deployment**
   - Check API health: `GET /health` → 200 OK
   - Verify database: `SELECT COUNT(*) FROM ReputationFlag;` → 0 (new table)
   - Verify cache: `redis-cli PING` → PONG
   - Check logs for errors

6. **Cohort gating**
   - Only `beta-rewriters` and `beta-explorers` see DDS auto-apply and anti-gaming features
   - Other users have unchanged experience (v2.0.0-beta feature set)

#### Rollback (if needed)

```bash
# Revert to v2.0.0-beta
git checkout v2.0.0-beta

# Rollback database (if migrations failed)
npx prisma migrate resolve --rolled-back <migration_name>

# Restart application
docker-compose restart
```

---

## How to Contribute

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## Version Numbering

- **2.0.0-rc**: Release Candidate (pre-production testing phase)
- **2.0.0**: General Availability (production release, scheduled S12)

See [docs/releases/](./docs/releases/) for detailed release notes and checklists.
