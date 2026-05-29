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

### Velocity-Burst Detection (Vote-Velocity Heuristic)

**Anomaly Signature:**

- **>10 votes** on same explanation or from same author
- **Within 5-minute window**
- **Indicates rapid coordinated voting**

**Detection Logic:**

```sql
SELECT explanation_id, author_id, COUNT(*) as vote_count,
       MIN(voted_at) as first_vote, MAX(voted_at) as last_vote
FROM explanation_votes
WHERE voted_at > NOW() - INTERVAL 5 MINUTES
GROUP BY explanation_id, author_id
HAVING COUNT(*) > 10 AND (MAX(voted_at) - MIN(voted_at)) <= INTERVAL 5 MINUTES
```

**Flag Action:**

- Mark all votes in burst window with reason: `velocity_burst`
- Place points on **hold** (not credited to leaderboard)
- Timestamp: when anomaly detected
- Idempotent: no duplicate flags for same explanation in same window

### Vote-Ring Detection

**Anomaly Signature:**

- **≥3 coordinated accounts** within same squad
- **Voting in round-robin pattern** (each voting for others' explanations)
- **Within 1-hour window**

**Detection Logic:**

```sql
SELECT squad_id, user_id, COUNT(DISTINCT voted_for_user_id) as unique_targets
FROM explanation_votes ev
JOIN users u ON ev.reviewer_id = u.id
WHERE ev.squad_id = ?
  AND ev.voted_at > NOW() - INTERVAL 1 HOUR
GROUP BY squad_id, user_id
HAVING COUNT(*) >= 3
  AND EXISTS (
    SELECT 1 FROM (
      SELECT reviewer_id, voted_for_user_id
      FROM explanation_votes
      WHERE squad_id = ?
        AND voted_at > NOW() - INTERVAL 1 HOUR
    ) AS votes_matrix
    WHERE votes_matrix.reviewer_id IN (SELECT user_id FROM ...)
      AND votes_matrix.voted_for_user_id IN (SELECT user_id FROM ...)
  )
```

**Flag Action:**

- Mark all votes in ring with reason: `vote_ring`
- Place points on **hold** (not credited to leaderboard)
- Escalate to moderation queue for human review
- Idempotent: no duplicate flags

### Response & Recovery

**Flagged Vote States:**

- **Pending:** Awaiting admin review
- **Cleared:** False positive; votes credited to leaderboard (FP tolerance <2%)
- **Confirmed:** Genuine abuse; points held, user warned

**Admin Actions:**

- **Clear:** Restore points; add squad to whitelist (optional)
- **Confirm:** Hold points permanently; restrict squad voting (optional)

**Metrics:**

- Track false-positive rate (cleared vs. confirmed)
- Target: <2% false-positive rate (strict for S11 launch)

---

## Rationale

### Why >10 Votes in 5 Minutes (Vote-Velocity)?

- **>10 votes:** Statistical rarity for legitimate reviewing (normal: 2–5 votes per 5 minutes per author)
- **5-minute window:** Captures rapid coordinated voting; balances sensitivity vs. false positives
- **Alternative thresholds considered:**
  - 5 votes / 5m: Too aggressive, would flag high-velocity legitimate reviewers (rejected)
  - 20 votes / 5m: Too permissive, allows coordinated campaigns (rejected)

### Why ≥3 Accounts in Vote-Ring?

- **Squad size:** Typical CertGym squads: 5–20 members
- **≥3 accounts:** Statistically unlikely accident; clear coordination signal
- **Configurable per squad size:** Smaller squads get higher thresholds to avoid false positives
- **1-hour window:** Fast enough to catch coordinated campaigns; loose enough to avoid false positives on async voting

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
