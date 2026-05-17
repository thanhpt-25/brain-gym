# Sprint 07 Monitoring: Alert Rules & Procedures

**US-706:** Bug pool monitoring, alert configuration, and post-release watch procedures.

---

## Alert Rule Thresholds

All alerts configured in Grafana dashboard: `/backend/monitoring/grafana-scenario-coach.json`

### Scenario Engine Alerts

| Metric                       | Threshold         | Severity | Action                                | Owner |
| ---------------------------- | ----------------- | -------- | ------------------------------------- | ----- |
| **Generation Latency (p95)** | > 2.0s            | HIGH     | Page on-call; investigate LLM timeout | BE    |
| **Generation Latency (p99)** | > 3.5s            | MEDIUM   | Log ticket; assess baseline drift     | Data  |
| **Success Rate**             | < 95%             | HIGH     | Rollback feature flag; investigate    | BE    |
| **LLM Cost/Scenario**        | > $0.10           | MEDIUM   | Cap generation requests; alert team   | Data  |
| **LLM Token Usage Rate**     | > 1000 tokens/min | MEDIUM   | Monitor quota consumption             | Data  |

### Coach Session Alerts

| Metric                       | Threshold | Severity | Action                                 | Owner    |
| ---------------------------- | --------- | -------- | -------------------------------------- | -------- |
| **Response Latency (p95)**   | > 2.0s    | HIGH     | Page on-call; check LLM service        | BE       |
| **Response Latency (p99)**   | > 3.5s    | MEDIUM   | Monitor for cascading delays           | BE       |
| **Error Rate**               | > 1.0%    | HIGH     | Rollback feature flag; investigate     | BE       |
| **Jailbreak Detection Rate** | > 0.5%    | MEDIUM   | Log all attempts; alert security       | Security |
| **LLM Cost/Session**         | > $0.15   | MEDIUM   | Implement cost cap; review token usage | Data     |

### Weekly Digest Alerts

| Metric                   | Threshold        | Severity | Action                             | Owner   |
| ------------------------ | ---------------- | -------- | ---------------------------------- | ------- |
| **Send Error Rate**      | > 5%             | HIGH     | Pause digest job; investigate SMTP | BE      |
| **Opt-Out Rate (1d)**    | > 10%            | HIGH     | Pause sends; review template       | Product |
| **Email Open Rate (1h)** | < 15% (baseline) | MEDIUM   | Log for retro analysis             | Product |
| **Click-Through Rate**   | < 3% (baseline)  | MEDIUM   | Analyze CTA placement              | Product |

---

## Post-Release Monitoring Procedures

**Window:** 24–48 hours after feature release  
**Owner:** On-call engineer + QA lead  
**Check-in:** Every 2 hours during business hours; nightly summary

### Release Day (Day 1)

#### Morning (09:00–12:00 UTC)

- [ ] **Grafana dashboard open** on monitor in war room
- [ ] **Alert rules active** — test one alert manually to confirm Slack/PagerDuty integration
- [ ] **Baseline metrics** — screenshot dashboard at T+0, T+30min, T+60min to establish expected range
- [ ] **Log aggregation** — verify CloudWatch/Datadog logs flowing for backend errors
- [ ] **Error budget check** — confirm we're within acceptable error rates for the feature
  - Scenario: < 5% errors
  - Coach: < 1% errors
  - Digest: < 5% send failures

#### Afternoon (12:00–18:00 UTC)

- [ ] **P50/P95 latency drift** — check if p95 response latency is stable vs baseline
- [ ] **Cost tracking** — verify cost/session is tracking within forecast
  - Scenario cost < $0.10/generation
  - Coach cost < $0.15/session
- [ ] **Load test results** — if production staging load test was run, compare metrics
- [ ] **User feedback** — check support queue, Twitter, community Slack for early complaints

#### Evening (18:00–24:00 UTC)

- [ ] **Night shift handoff** — summarize key metrics to on-call overnight engineer
- [ ] **Low-traffic validation** — baseline behavior during off-peak hours
- [ ] **Log review** — scan for any ERROR/FATAL entries in backend logs

### Release Day +1 (Day 2)

#### Morning (09:00–12:00 UTC)

- [ ] **Overnight incident check** — review any alerts that fired during night
- [ ] **Metric stability** — compare p95 latency, error rate, cost vs Day 1 baseline
  - p95 latency should be within ±5% of baseline
  - Error rate should be flat, no drift
  - Cost should be within ±10% of forecast
- [ ] **Digest metrics** (if scheduled) — check send success rate, opt-out rate
- [ ] **Linear triage** — create P0/P1 tickets for any observed issues

#### Afternoon (12:00–18:00 UTC)

- [ ] **Load pattern analysis** — verify feature scales linearly with user load
- [ ] **Database performance** — check query logs for N+1 patterns, slow queries
- [ ] **Cache hit rate** — verify Redis cache efficiency (if applicable)
- [ ] **Third-party service health** — LLM API status, email service uptime

#### EOD (16:00–17:00 UTC)

- [ ] **Incident review** — document any issues that occurred
- [ ] **Decision point** — proceed to next gate or hold if issues found
- [ ] **Stakeholder update** — brief product/engineering leads on stability

---

## Bug Triage & Linear Integration

### Severity Classification

When bugs are discovered during post-release watch:

| Priority          | Definition                                              | Example                                            | SLA         |
| ----------------- | ------------------------------------------------------- | -------------------------------------------------- | ----------- |
| **P0 (Critical)** | Production outage; user data loss; security breach      | Cost spike >500%, error rate >10%, data corruption | 30 min      |
| **P1 (High)**     | Feature broken for majority of users; workaround exists | Latency >5s p95, 5% error rate, Jailbreak bypass   | 4 hours     |
| **P2 (Medium)**   | Feature degraded; workaround or affecting minority      | Latency 2-5s p95, <1% error rate, UI glitch        | 24 hours    |
| **P3 (Low)**      | Non-critical; can defer to next sprint                  | Typo in explanation text, optional feature broken  | Next sprint |

### Triage Workflow

1. **Alert fires** → On-call checks dashboard + logs
2. **Categorize** → Assign priority + component (scenario-engine, ai-coach, digest)
3. **Create Linear ticket** → Link to gate decision doc, assign owner
4. **Escalate if P0** → Page incident commander, notify product lead
5. **Mitigate** → Rollback feature flag if P0, post-incident review within 24h

### Linear Ticket Template

```
Title: [P{0-3}] {Feature} — {Brief Description}

Component: scenario-engine | ai-coach | digest | other
Gate: Gate 1 | Gate 2 | Gate 3 | Post-Release

## Description
What users/systems are experiencing...

## Reproduction Steps
1. ...
2. ...

## Impact
Affected users: {percentage}
Severity: {P0-P3}
Revenue impact: {if applicable}

## Logs
Dashboard: {Grafana panel link}
Error logs: {CloudWatch/Datadog link}
Relevant traces: {attach if available}

## Root Cause (after investigation)
...

## Remediation
- [ ] Short-term fix applied
- [ ] Long-term fix tracked for next sprint
- [ ] Post-incident review completed
```

---

## Gate Passage Criteria

### Gate 1 (Day 4 EOD): Scenario Quality

✓ No P0 incidents  
✓ Error rate < 5%  
✓ Latency p95 < 2.0s  
✓ Cost < $0.10/scenario

### Gate 2 (Day 6 EOD): Coach Cost Model

✓ No P0 incidents  
✓ Cost < $0.10/session (10% ramp)  
✓ Error rate < 1%  
✓ Latency p95 < 2.0s

### Gate 3 (Day 9 EOD): Digest Engagement

✓ No P0 incidents  
✓ Opt-out rate < 5%  
✓ Open rate > 25%  
✓ CTR > 5%

---

## Escalation & Incident Response

### On-Call Escalation Chain

1. **Alert fires** → On-call engineer (30 min response)
2. **No response / P1 issue** → Page incident commander (15 min response)
3. **Still unresolved** → Notify engineering lead (30 min response)
4. **Critical (P0)** → CEO/CTO notified within 1 hour

### Incident Commander Duties

- [ ] Gather information from on-call
- [ ] Determine rollback vs hotfix
- [ ] Communicate status to stakeholders every 30 min
- [ ] Assign RCA owner (due within 24 hours)
- [ ] Post-incident review with team (within 48 hours)

### Post-Incident Review (RCA)

**Within 24 hours of P0 incident:**

1. **Timeline** — what happened, when, who noticed
2. **Root cause** — why did it happen?
3. **Contributing factors** — what gaps allowed this to slip?
4. **Fixes** — immediate (rolled back feature) and long-term (code/process)
5. **Action items** — assigned owner + due date

---

## Monitoring Runbook

### If Scenario Latency Alert Fires

```
1. Check Grafana: Is p95 > 2.0s?
2. Check LLM API status: Monitor provider dashboard
3. Check queue length: BullMQ dashboard or DB query
4. If LLM slow: Wait 5 min, check again
5. If queue backlogged: Scale workers or reduce ramp percentage
6. If persistent: Post P1 ticket + notify data lead
```

### If Coach Cost Exceeds Budget

```
1. Check Grafana: Which feature is driving cost?
2. Review latest LLM call logs (CloudWatch)
3. Identify expensive patterns: Long conversations? Large context?
4. Options:
   a. Reduce max conversation turns
   b. Trim context window size
   c. Switch to cheaper model tier
   d. Pause feature, ramp down
5. Post ticket with remediation plan
```

### If Digest Opt-Out Rate > 10%

```
1. Check email open/click rates (Grafana panel)
2. Review feedback: Support tickets, user comments
3. Hypothesis: Frequency? Content? Delivery time?
4. Actions:
   a. Check send success rate (email provider logs)
   b. Review template rendering (test in Outlook, Gmail)
   c. Adjust frequency or content if applicable
5. Communicate change to users if made
6. Document learnings for retro
```

---

## Success Metrics Summary

**Post-Release Monitoring Checklist:**

- [ ] 48 hours of monitoring completed without P0 incidents
- [ ] All gate passage criteria met
- [ ] Dashboard configured and alerts tested
- [ ] Linear ticket triage completed
- [ ] RCA (if needed) published
- [ ] Team feedback captured for retro
