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

- **≥5 votes** on the same explanation within the velocity window (default)
- **Within 60-second window** (default)
- Thresholds are configurable via env vars:
  - `REPUTATION_VELOCITY_BURST_THRESHOLD` (default: `5`)
  - `REPUTATION_VELOCITY_WINDOW_MS` (default: `60000` ms = 60 s)

**Implementation:**

The detection is performed by `detectAnomaly()` in
`backend/src/squads/peer-review/peer-review.service.ts`. It queries
`ExplanationVote` rows within the velocity window and compares the count to
the threshold. Returns `'velocity_burst'` if exceeded.

**Flag Action:**

- Vote accrual is skipped; a `ReputationFlag` row is created with
  `reason = 'velocity_burst'`
- Points are held (not credited to leaderboard)
- Idempotent: existing flag check before inserting a new one

> Note: The original threshold proposed in this ADR was **>10 votes / 5 minutes**.
> The shipped implementation defaults to **≥5 votes / 60 seconds**, matching
> the env-var defaults in `peer-review.service.ts`.

### Vote-Ring Detection

**Anomaly Signature:**

- A voter has already voted on **≥3 explanations** from the same author within the same squad (configurable via `REPUTATION_RING_THRESHOLD`, default: `3`)
- No time window — checks all-time cross-votes per voter/author/squad combination

**Implementation:**

The detection is performed inside the same `detectAnomaly()` method in
`backend/src/squads/peer-review/peer-review.service.ts`. It counts how many
of the target author's explanations the current voter has already upvoted in
this squad. Returns `'vote_ring'` if the count meets or exceeds the threshold.

**Flag Action:**

- Vote accrual is skipped; a `ReputationFlag` row is created with
  `reason = 'vote_ring'`
- Points are held (not credited to leaderboard)
- Admin review required to clear or confirm
- Idempotent: existing flag check before inserting

> Note: The original 1-hour sliding window described here was not implemented.
> The shipped logic checks all-time votes from the same voter to the same
> author within the squad, not a time-bounded window. The ≥3 account threshold
> refers to the number of cross-votes, not distinct coordinated accounts.

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

### Why ≥5 Votes in 60 Seconds (Vote-Velocity)?

- **≥5 votes:** Flags rapid coordinated activity while tolerating normal async reviewing patterns
- **60-second window:** Short enough to catch burst activity; tunable via `REPUTATION_VELOCITY_WINDOW_MS`
- **Configurable thresholds** (`REPUTATION_VELOCITY_BURST_THRESHOLD`, `REPUTATION_VELOCITY_WINDOW_MS`) allow adjustment without a code deploy if false-positive rates are too high

### Why ≥3 Cross-Votes in Vote-Ring?

- **≥3 votes from same voter to same author:** Statistically unlikely to be coincidental in small squads; clear preferential-voting signal
- **Configurable via `REPUTATION_RING_THRESHOLD`:** Threshold can be raised for larger squads without a code deploy
- **All-time window:** Persistent cross-vote pattern is more reliable than a short time window for detecting ring behaviour across sessions

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

- **Backend:** `peer-review.service.ts:detectAnomaly()` — single method handles both `velocity_burst` and `vote_ring` checks; called inside `vote()` before any point accrual
- **Database:** Flag records in `reputation_flags` table (`backend/prisma/schema.prisma`)
- **Admin UI:** `src/pages/admin/ReputationTab.tsx` (US-1102) for flag review + clearance
- **Monitoring:** Dashboard panels (US-1106) track detection rates

---

## Approval

- **Product Lead:** Reputation team
- **Engineering Lead:** Backend team
- **Security Lead:** Approved (anti-abuse control)
- **Date Approved:** 2026-05-24
