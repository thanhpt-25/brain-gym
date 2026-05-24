# ADR-027: Reputation Anti-Gaming Detection Thresholds

**Status:** Accepted (Sprint 11)  
**Date:** 2026-05-24  
**Context:** Detecting and flagging anomalous voting patterns to prevent reputation inflation

---

## Problem

Reputation in CertGym is earned through peer review votes. Without anti-gaming controls, coordinated squads can artificially inflate scores via:

- **Velocity bursts:** Multiple votes on same explanation in rapid succession
- **Vote rings:** Coordinated voting across squad members

This ADR defines detection thresholds and response policies.

---

## Decision

### Velocity-Burst Detection

**Anomaly Signature:**

- **≥5 votes** on a single explanation
- **Within 10-second window**
- **By same or different reviewers**

**Detection Logic:**

```sql
SELECT vote_count, MIN(voted_at) as first_vote, MAX(voted_at) as last_vote
FROM explanation_votes
WHERE explanation_id = ?
GROUP BY explanation_id
HAVING COUNT(*) >= 5 AND (MAX(voted_at) - MIN(voted_at)) <= INTERVAL 10 SECONDS
```

**Flag Action:**

- Mark all votes in burst window with reason: `velocity_burst`
- Place points on **hold** (not credited to leaderboard)
- Timestamp: when anomaly detected
- Idempotent: no duplicate flags for same explanation in same window

### Vote-Ring Detection

**Anomaly Signature:**

- **3+ coordinated votes** within same squad
- **On same explanation** in rapid succession (within 1 minute)
- **All voting on behalf of same user** (or same question)

**Detection Logic:**

```sql
SELECT user_id, explanation_id, squad_id, COUNT(*) as vote_count
FROM explanation_votes
WHERE squad_id = ?
  AND voted_at > NOW() - INTERVAL 1 MINUTE
GROUP BY user_id, explanation_id, squad_id
HAVING COUNT(*) >= 3
```

**Flag Action:**

- Mark all votes in ring with reason: `vote_ring`
- Place points on **hold** (not credited to leaderboard)
- Escalate to moderation queue (optional human review)
- Idempotent: no duplicate flags

### Response & Recovery

**Flagged Vote States:**

- **Pending:** Awaiting admin review
- **Cleared:** False positive; votes credited to leaderboard
- **Confirmed:** Genuine abuse; points held, user warned

**Admin Actions:**

- **Clear:** Restore points; add reviewer to whitelist (optional)
- **Confirm:** Hold points permanently; restrict user voting (optional)

**Metrics:**

- Track false-positive rate (cleared vs. confirmed)
- Target: <5% false-positive rate (acceptable for learning system)

---

## Rationale

### Why 5 Votes in 10 Seconds?

- **5 votes:** Statistical rarity for legitimate reviewing (normal: 1–2 votes per minute)
- **10-second window:** Too fast for honest reviewers reading explanation; clear intent signal
- **Alternative thresholds considered:**
  - 3 votes / 10s: Too aggressive, would flag edge cases (rejected)
  - 10 votes / 30s: Too permissive, allows coordinated campaigns (rejected)

### Why 3+ Votes in Vote-Ring?

- **Squad size:** Typical CertGym squads: 5–20 members
- **3+ votes:** Statistically unlikely accident; coordination signal
- **1-minute window:** Fast enough to catch coordinated bursts; loose enough to avoid false positives

### Why Point Hold (Not Deletion)?

- **Reversible:** If false positive, points restored without user loss
- **Deterrent:** User sees held points; knows system is watching
- **Audit trail:** Clear record of flagged votes for moderation review

### Why "Idempotent" Requirement?

- Prevents double-flagging same vote
- System may re-run detection on schedule; need stable results
- Implementation: Check if vote already flagged before creating new flag record

---

## Consequences

### Positive

✅ Detects high-velocity voting abuse without false positives  
✅ Catches coordinated squads before widespread reputation damage  
✅ Transparent to users (held points visible in reputation dashboard)  
✅ Reversible mechanism supports fair play recovery

### Risks

⚠️ 5-vote threshold may miss subtle coordinated campaigns  
⚠️ Vote-ring detection requires live squad analysis (performance impact)  
⚠️ Held points may discourage legitimate reviewers if flagged frequently  
⚠️ Manual clearance process adds operational overhead

---

## Monitoring & Adjustment

**Metrics to Track (US-1106):**

- Velocity-burst detection rate (per day, per squad)
- Vote-ring detection rate (per day, per squad)
- False-positive rate (cleared vs. confirmed ratio)
- Point hold vs. release ratio

**Adjustment Triggers:**

- False-positive rate >10%: Loosen thresholds (increase vote count or time window)
- Detection rate >5% of all votes: Investigate for gaming campaign
- User complaints >3 per week: Review threshold sensitivity with product team

---

## Implementation

- **Backend:** `peer-review.service.ts:detectVelocityBurst()` + `detectVoteRing()`
- **Database:** Flag records in `reputation_flags` table
- **Admin UI:** `ReputationTab.tsx` (US-1102) for flag review + clearance
- **Monitoring:** Dashboard panels (US-1106) track detection rates

---

## Approval

- **Product Lead:** Reputation team
- **Engineering Lead:** Backend team
- **Security Lead:** Approved (anti-abuse control)
- **Date Approved:** 2026-05-24
