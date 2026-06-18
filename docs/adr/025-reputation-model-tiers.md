# ADR-025 — Reputation Model and Tier Thresholds

**Status:** Accepted  
**Date:** 2026-05-23  
**Deciders:** Tech Lead, BE  
**Related:** US-1005, US-020 (Peer Review Challenge, S9)

---

## Context

Sprint 9 shipped Peer Review Challenge with a single binary badge (`top-explainer`) awarded when an explanation reaches 5 upvotes. This does not reflect the full range of contribution quality — a user with 50 upvotes across multiple top explanations looks identical to one who crossed the threshold once. Sprint 10 replaces the binary badge with a tiered reputation system.

Requirements:

- Points accrue per event, not per badge threshold crossing, so the score reflects ongoing contribution.
- Tiers must be deterministic and auditable from the points value alone.
- Self-gaming (self-vote, vote stuffing within a squad) must be structurally prevented, not just policy-prevented.
- The leaderboard must be scoped per squad to avoid cross-squad comparison noise.

---

## Decision

### Data model

```
UserReputation {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  squadId   String   @map("squad_id")
  points    Int      @default(0)  // cumulative, never decremented
  updatedAt DateTime @updatedAt @map("updated_at")
  @@unique([userId, squadId])
  @@index([squadId, points])
  @@map("user_reputations")
}
```

Points are per-squad. A user who contributes to two squads has two independent reputation records.

### Point accrual events

| Event                                             | Delta    |
| ------------------------------------------------- | -------- |
| Explanation upvoted                               | +1       |
| Explanation promoted to `isTop=true` (first time) | +2 bonus |

Points are accrued via `userReputation.upsert` with `{ increment: delta }` — idempotent on re-vote because `vote.findFirst` guards the duplicate path before any accrual.

### Tier thresholds

| Tier   | Threshold   | Badge name         |
| ------ | ----------- | ------------------ |
| Gold   | ≥ 50 points | `gold-explainer`   |
| Silver | ≥ 20 points | `silver-explainer` |
| Bronze | ≥ 5 points  | `bronze-explainer` |
| None   | < 5 points  | —                  |

Thresholds are evaluated after every accrual. The highest eligible tier badge is awarded (upserted into `BadgeAward`). No badge is downgraded.

### Leaderboard

`GET /squads/:squadId/reputation/leaderboard?limit=N` returns the top N members ordered by points descending, with their resolved tier. `displayName` is a required non-nullable field on the `User` model in `schema.prisma`.

### Anti-gaming

- **Self-vote** — blocked at the service layer (`BadRequestException` when `voterId === explanation.authorId`).
- **Idempotency** — `vote.findFirst` check before transaction; duplicate vote returns current counts without incrementing.
- **Squad scope** — points are per-squad, so cross-squad vote rings do not inflate a single leaderboard.
- S11 candidate: velocity-based anomaly detection (unusually high vote rate from a single voter in a short window).

---

## Rationale

**Why per-squad scope rather than global?**
Different squads have different sizes, activity levels, and certification focuses. A global leaderboard would be dominated by members of the largest squads and would not reflect quality relative to the user's actual learning community.

**Why cumulative (never decrement) rather than net score?**
Downvote mechanics create adversarial dynamics in small communities. Cumulative points reward sustained contribution without punishing early mistakes. Tier thresholds are set high enough that gaming via isolated upvotes is not economically worthwhile.

**Why three tiers (Bronze/Silver/Gold) rather than continuous score display?**
Tiers provide social anchors — users understand "I'm Silver, targeting Gold" better than "I have 23 points." Three tiers matches common gamification research showing diminishing returns beyond 3-4 levels for intrinsic motivation.

**Why upsert BadgeAward rather than insert?**
A user who oscillates around a threshold boundary (edge case from future point adjustments) should not accumulate duplicate badge records. Upsert keeps badge state idempotent.

---

## Consequences

**Positive:**

- Tiered reputation gives high contributors visible recognition beyond the binary top-badge.
- Leaderboard enables squad-level social comparison without cross-squad noise.
- The model is simple enough to reason about from a raw SQL query.

**Risks:**

- Small squads (< 5 active members) may have leaderboards dominated by one user — acceptable since the leaderboard is squad-scoped and reflects reality.
- No point decay — a highly-active early user retains their tier indefinitely even if they stop contributing. Reassess in S12 if churn data suggests this harms newcomer motivation.
