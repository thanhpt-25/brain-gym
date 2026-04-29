# ADR 002 — Question SRS Fields (US-103)

**Status:** Accepted  
**Date:** 2026-04-29  
**Deciders:** ThanhPT

---

## Context

`ReviewSchedule` already stores the core SM-2 fields (`interval`, `easeFactor`,
`repetitions`), but lacks the data needed to:

1. Compute mastery levels per the composite rule (reps, EF, lapses).
2. Track quality of the last review session for analytics.
3. Record an explicit "last reviewed" timestamp independent of `updatedAt`
   (which changes on any write, not just a review event).
4. Efficiently query which questions are due for a user
   (`WHERE user_id = ? AND next_review_date <= NOW()`).

Without these fields, Sprint 2's review-session endpoint and the SRS service
layer cannot be built.

---

## Decision

### Schema changes to `ReviewSchedule`

| Change                                     | Detail                                                |
| ------------------------------------------ | ----------------------------------------------------- |
| Rename `interval` → `intervalDays`         | Clarifies unit; data-safe via `RENAME COLUMN`         |
| Add `mastery FlashcardMastery DEFAULT NEW` | Reuses existing `FlashcardMastery` enum               |
| Add `lastQuality Int?`                     | Stores 0–5 quality from the last review               |
| Add `lapses Int DEFAULT 0`                 | Counts reviews where `quality < 3`                    |
| Add `lastReviewedAt DateTime?`             | Explicit review timestamp, decoupled from `updatedAt` |
| Add `@@index([userId, nextReviewDate])`    | Covers due-review query pattern                       |

### Quality scale (TD1)

SM-2 quality uses the full **0–5** range.  
UI mapping: `Again=2 / Hard=3 / Good=4 / Easy=5`.

### Mastery composite rule (TD2)

```
NEW      — repetitions == 0
LEARNING — repetitions < 3  ||  easeFactor < 2.0
REVIEW   — (not MASTERED) && repetitions >= 3 && lapses < 2
MASTERED — repetitions >= 6 && easeFactor >= 2.5 && lapses < 3
```

MASTERED takes priority over REVIEW when all its conditions are satisfied.

### Migration strategy (TD9)

`interval` is renamed (not dropped and re-added) to preserve existing data.
Production data volume is small so the in-place rename is safe with a single
`ALTER TABLE … RENAME COLUMN` statement.

---

## Consequences

### Positive

- All fields needed for the SM-2 pure function and mastery computation are now
  persisted in one row — no extra joins required in the review service.
- The composite index on `(user_id, next_review_date)` covers the primary
  "fetch due questions" query without a full table scan.
- `FlashcardMastery` enum is reused from the flashcard SRS domain, keeping the
  mastery vocabulary consistent across both review tracks.

### Risks / mitigations

- **`interval` rename:** any code referencing the old column name will fail at
  runtime after the migration. All references have been updated in the Prisma
  schema; application code using `PrismaClient` will get a compile-time error if
  the old field name is used.
- **Nullable fields:** `lastQuality` and `lastReviewedAt` are nullable on
  purpose — existing rows have never been reviewed, so there is no value to
  backfill.
- **No endpoint wired yet:** the new fields are schema-only in Sprint 1.
  The review-session endpoint that writes to them is scoped to Sprint 2.
