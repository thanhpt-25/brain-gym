# ADR-026: DDS Auto-Apply GA & Canary Promotion Policy

**Status:** Accepted (Sprint 11)  
**Date:** 2026-05-24  
**Context:** Promoting DDS auto-apply from shadow mode (logging) to live execution (Gate 2)

---

## Problem

DDS auto-apply requires a two-gate promotion strategy:

- **Gate 1 (Shadow Mode):** Log auto-apply suggestions without executing; collect correctness metrics
- **Gate 2 (Live Mode):** Execute auto-apply for validated cohorts; enable canary pause on high rollback rates

This ADR defines the thresholds and policies for both gates.

---

## Decision

### Gate 1: Shadow Mode → Live Mode Transition

**Readiness Criteria:**

- Minimum **30 clean approvals** (approvals without correctness violations)
- **Zero rollbacks** in the observation window (last 7 days)
- **Correctness violation rate < 5%** (violations caught at proposal time)

**Validation Period:** 14 days of shadow mode logging

**Success Metric:** ≥80% of auto-apply suggestions align with expert review

### Gate 2: Canary Pause Policy

**Rollback Detection:**

- Window: 10-minute sliding window
- Threshold: >5% rollback rate triggers canary pause (configurable in `dds.service.ts`)
- Rollback Window: last 50 variants (configurable)
- Rollback definition: `status = ROLLED_BACK` in variants table

**Canary Pause Behavior:**

- When threshold exceeded: set `DdsConfig.shadowModeEnabled = true` for the cohort (DB update, no redeploy required)
- Effect: Stop executing; revert to logging mode (auto-pause)
- Recovery: Manual decision to retry promotion after investigation via `POST /ai-question-bank/dds/auto-apply/promote`
- Alert: Emit `US-1106` alert via monitoring system

**Alert Escalation:**

- Critical: Rollback rate >10% → page on-call engineer
- Warning: Rollback rate 5–10% → trigger Slack notification
- Info: Rollback rate <5% → log for dashboard review

---

## Rationale

### Why 30 Clean Approvals?

Sample size sufficient for statistical confidence:

- 30 samples at 95% CI with ±10% margin of error
- Reasonable time horizon: ~3–7 days in production shadow mode
- Aligns with S10 team velocity

### Why Zero Rollbacks at Gate 2?

Rollback indicates a systematic issue:

- Single rollback may be an edge case
- Multiple rollbacks (>1) signal model degradation
- Conservative threshold ensures operator confidence in auto-apply

### Why 10-Minute Canary Window?

- **Too short** (<1 min): Noise from single bad requests
- **Too long** (>30 min): Too much bad auto-apply before pause
- **10 min:** Allows ~20–40 question variants to execute; detects systematic failure quickly
- **Last 50 variants:** Configurable window size for flexible canary strategies

### Why >5% Rollback Rate Threshold?

- **Below 5%:** Acceptable within normal variation; expected for learning system
- **5–10%:** Warning level; likely issue requiring investigation
- **Above 10%:** Critical failure; immediate human intervention needed
- **Configurable:** Threshold stored in `dds.service.ts` for runtime tuning without code deploy

---

## Consequences

### Positive

✅ Conservative progression reduces risk of widespread auto-apply errors  
✅ Clear numeric thresholds enable automated decision-making  
✅ Canary pause mechanism allows rapid recovery without manual intervention

### Risks

⚠️ 30-approval threshold may delay GA by 1–2 weeks if volume is low  
⚠️ Zero-rollback policy is strict; even single edge case blocks promotion  
⚠️ Manual recovery after canary pause requires investigation + re-approval

---

## Implementation

- **Gate 1 readiness check:** `GET /ai-question-bank/dds/auto-apply/readiness` (US-1107)
- **Gate 2 promotion endpoint:** `POST /ai-question-bank/dds/auto-apply/promote` (US-1101)
- **Canary pause logic:** Implemented in `dds.service.ts:promoteToLiveMode()`
- **Alert rules:** Configured in monitoring (US-1109)

---

## Approval

- **Product Lead:** DDS team
- **Engineering Lead:** Backend team
- **Date Approved:** 2026-05-24
