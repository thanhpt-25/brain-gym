# Sprint 5 Post-Release Watch — v1.3.0-alpha

**Owner:** On-Call Engineer  
**Duration:** Days 1–5 of Sprint 5 (2026-05-29 → 2026-06-02)  
**Scope:** Sprint 4 v1.2.0 metrics + Sprint 5 feature flags (FF_SQUADS_BETA, FF_INSIGHTS_BETA)  
**Escalation:** PO if P1 (user-facing regression), Tech Lead if P2 (backend stability)

---

## 1. Metrics to Watch

### SLA Compliance (Existing Exam Engine)

| Metric                               | Target | Baseline | Watch Window                   |
| ------------------------------------ | ------ | -------- | ------------------------------ |
| Exam load time (p95)                 | <3s    | 2.8s     | Regression >3.5s = alert       |
| Mark-for-review toggle latency (p99) | <500ms | 420ms    | Regression >600ms = alert      |
| Submit exam (p99)                    | <2s    | 1.8s     | Regression >2.5s = alert       |
| Strobe light animation jank (CLS)    | <0.1   | 0.05     | Regression >0.15 = investigate |

**Action:** If any baseline broken >10% threshold, check:

- Redis connection pool exhaustion
- Database connection limits
- New Sprint 5 queries on critical path

### RLS Phase-2 Audit Logs

| Event                            | Expected Rate | Threshold | Action                        |
| -------------------------------- | ------------- | --------- | ----------------------------- |
| Unauthorized org access attempts | ~5–10/day     | >50/day   | P2: Check ACL rules           |
| RLS policy enforcement errors    | ~0/day        | >5/day    | P1: Check migrations          |
| Org context mismatches           | ~0/day        | >2/day    | P2: Investigate session state |

Check Postgres logs:

```sql
-- Org access denied events (from RLS audit trigger)
SELECT COUNT(*), event_type
FROM org_audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type;
```

### Behavioral Insights Pipeline (Beta)

| Metric                           | Expected          | Watch For         | Action                            |
| -------------------------------- | ----------------- | ----------------- | --------------------------------- |
| Nightly job completion rate      | 100%              | <95% success rate | P2: Check job queue, logs         |
| Insight generation latency (p99) | <45s per 5k users | >60s              | P2: Profile query performance     |
| False-positive dismissal rate    | ~80% after 24h    | >90% = too noisy  | P2: Increase confidence threshold |
| Processing errors                | ~0                | >5 per night      | P2: Check user data anomalies     |

**Monitor via:**

- Grafana dashboard: BehavioralInsight nightly job
- CloudWatch/Datadog: Job queue depth, error rate
- Database: Count of `BehavioralInsight` records created per night

### LLM Quota Blocking (Beta)

| Metric                      | Expected               | Threshold            | Action                       |
| --------------------------- | ---------------------- | -------------------- | ---------------------------- |
| Free tier over-quota blocks | ~2–5 per day           | >20/day = widespread | P2: Cap limit may be too low |
| Paid tier over-quota blocks | ~0 per day             | >1/day = bug         | P1: Check quota calculation  |
| 429 response rate           | <1% of AI gen requests | >5%                  | P2: Investigate quota churn  |
| Grafana alert firing rate   | ~0                     | >1 per day           | P1: Check alert sensitivity  |

**Check:**

- `LLMUsage` table for quota enforcement correctness
- Logs for 429 response reasons (daily cap vs request limit)
- Verify alerts configured in Grafana

---

## 2. Feature Flag Monitoring

### FF_SQUADS_BETA

**Rollout:** Beta cohort (30–50 users)

| Check                                 | Frequency | Action If Broken                  |
| ------------------------------------- | --------- | --------------------------------- |
| Squad creation success rate           | Daily     | >5% failures = investigate schema |
| Invite link generation latency        | Daily     | >1s = rate limiter too strict     |
| Join squad 404 errors                 | Daily     | >2% = token expiry issue          |
| Member readiness rendering (frontend) | Every 2h  | Any errors = revert FE flag       |

### FF_INSIGHTS_BETA

**Rollout:** 10–20% of beta cohort

| Check                                    | Frequency    | Action If Broken                           |
| ---------------------------------------- | ------------ | ------------------------------------------ |
| Banner rendering errors                  | Every 4h     | Any errors = revert FE flag                |
| Insight dismissal rate trend             | Daily        | >95% = insight not valuable, PO decision   |
| Confidence score accuracy vs actual pass | Post-release | Correlation <0.5 = model rework (Sprint 6) |

---

## 3. Escalation Decision Tree

```
Issue detected
├─ User-facing regression (SLA, load, rendering) → P1: Page PO + Tech Lead
├─ Data integrity issue (RLS, quota, audit) → P1: Page Tech Lead + Security Champion
├─ Backend instability (job failures, logs full) → P2: Slack #oncall + standby eng
├─ Metrics anomaly (nightly job >60s) → P2: Log issue, monitor next 24h
└─ Beta feature-specific (Squad invite fails, Insight noisy) → P2: Slack PO + owning eng
```

**On-Call Contacts:**

- PO: Slack @po-oncall
- Tech Lead: Slack @tech-lead
- Security Champion: Slack @security

---

## 4. Daily Checklist (Days 1–5)

### Morning (UTC 9:00)

- [ ] Run SLA compliance dashboard query (see §1)
- [ ] Check RLS audit log spike
- [ ] Verify nightly BehavioralInsight job completed
- [ ] Review 429 quota blocks from previous 24h
- [ ] Check feature flag error logs (FF_SQUADS_BETA, FF_INSIGHTS_BETA)

### Afternoon (UTC 14:00)

- [ ] Spot-check Grafana dashboards for anomalies
- [ ] Confirm Postgres connection pool healthy (`SHOW max_connections`)
- [ ] Verify Redis is not evicting keys (monitor memory)

### End-of-Day (UTC 17:00)

- [ ] Log summary in #oncall Slack thread
- [ ] Handoff to next on-call if watch continues

---

## 5. Rollback Triggers

**Automatic Rollback (within 1h of detection):**

- SLA regression >15% on any critical path metric
- RLS policy enforcement errors >10 in 24h
- Feature flag error rate >5% sustained

**Manual Rollback Decision (Tech Lead + PO):**

- Behavioral Insight false-positive rate >90% dismissal sustained >24h
- Squads feature adoption <5 squads created in 48h (adoption signals)

---

## 6. Known Unknowns

| Unknown                               | Resolution                                  | Owner             |
| ------------------------------------- | ------------------------------------------- | ----------------- |
| RLS policy correctness on live data   | Will verify during watch window             | Security Champion |
| Behavioral Insight accuracy threshold | Calibrate if dismissal rate anomalous       | Senior BE         |
| Quota enforcement edge cases          | May find bugs during beta; log for Sprint 6 | Platform          |

---

## 7. End-of-Watch Handoff

**At end of Day 5 (2026-06-02, 17:00 UTC):**

On-call engineer prepares summary for retro:

- Metrics summary (pass/fail against thresholds)
- Issues found (none, minor, major)
- Rollback decisions made (if any)
- Recommendations for Sprint 6

File: `docs/team-planning/sprint-05-retro.md` (Section 10: Post-Release Watch Summary)

---

## Sign-Off

- **On-Call Engineer:** [Name] — Days 1–5 assigned
- **Tech Lead:** ✅ Approved watch scope
- **PO:** ✅ Aware of rollback triggers

**Created:** 2026-05-29 (US-510)  
**Effective:** 2026-05-29 00:00 UTC  
**Expires:** 2026-06-02 17:00 UTC
