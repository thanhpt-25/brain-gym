# RFC-003: Pass Predictor v0 (Heuristic Readiness Score)

## Status

Draft — opened Sprint 3 (US-307 spike). Target approval: end of Sprint 4
after beta-cohort validation (see §Success Metrics).

## Context

CertGym's product vision (`docs/team-planning/01-product-owner.md`, US-001)
calls for a **Readiness Score** that tells learners "you have an X% chance of
passing today" and feeds the Coach feature (RFC-004) with actionable next
steps. This is a Q3 OKR commitment (O4: "Ship a defensible readiness signal
to ≥ 200 beta users with Pearson r ≥ 0.75 vs actual pass outcome").

Two questions need answers before touching production code:

1. **Can a simple weighted heuristic clear the r ≥ 0.75 bar?** If yes, defer
   the ML investment by a quarter and ship value sooner.
2. **What is the minimum data contract** the predictor needs from
   `attempt_events` (US-301)? Locking this lets BE finalize the schema in
   Sprint 3 without speculative columns.

This RFC proposes a v0 heuristic, a validation plan, and a tier-gating
decision so dependent stories (US-308 UI, RFC-004 Coach) can proceed.

Related docs:

- Spike notebook: `backend/scripts/predictor-spike.md`
- Event schema: RFC-001 (AttemptEvent, Sprint 3)
- Coach: RFC-004 (depends on this RFC)

---

## Decision

Build a **weighted heuristic readiness score** in the range 0–100, with an
associated confidence value in the range 0–1, computed per
`(userId, certificationId)` pair. The heuristic is deterministic, pure, and
explainable via per-signal contributions. ML upgrade is deferred to Sprint 6
and only triggered if validation fails to meet the target metric.

---

## Input Contract

Consumed from `attempt_events` (US-301) and existing tables:

| Field source     | Field                         | Used for             |
| ---------------- | ----------------------------- | -------------------- |
| `attempt_events` | `userId`                      | grouping             |
| `attempt_events` | `questionId`                  | coverage, accuracy   |
| `attempt_events` | `isCorrect` (payload field)   | accuracy             |
| `attempt_events` | `timeSpentMs` (payload field) | time pressure        |
| `attempt_events` | `serverTs`                    | recency weighting    |
| `Question`       | `domainId`, `certificationId` | domain spread        |
| `Certification`  | `expectedSecondsPerQuestion`  | time pressure norm   |
| `Certification`  | `totalQuestionCount`          | coverage denominator |

The predictor reads only — it does not mutate `attempt_events`.

---

## Output Contract

Logical model (NOT a Prisma migration in this RFC — productionize in Sprint 5):

```prisma
model ReadinessScore {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  certificationId String   @map("certification_id")
  score           Int      // 0..100
  confidence      Float    // 0..1
  signals         Json     // { srsCoverage, recentAccuracy, domainSpread,
                           //   timePressure, attemptCount, contributions,
                           //   weightsVersion }
  computedAt      DateTime @default(now()) @map("computed_at")

  @@unique([userId, certificationId])
  @@index([certificationId, score])
  @@map("readiness_scores")
}
```

`signals` is denormalized JSON so the Coach can read contributions without
re-running the heuristic, and so weight changes are auditable via `weightsVersion`.

---

## Heuristic Formula

```
readiness = (
    0.35 * srs_coverage
  + 0.40 * recent_accuracy
  + 0.15 * domain_spread
  + 0.10 * clamp(time_pressure, 0, 1)
) * 100

confidence = min(attempt_count / 50, 1.0)
```

Weights are stored in `predictor.config.ts` (config, not constants) so
weight revisions do not require redeploying business logic. Store
`weightsVersion` in the `signals` JSON field on every write.

Full weight rationale and TypeScript pseudocode: `backend/scripts/predictor-spike.md §3–4`.

---

## Tier Gate (PO Decision D1)

**Premium-only at launch.** Free-tier users see a blurred score plus an
"Unlock your readiness score" CTA that opens the upgrade flow.

Rules:

- The underlying computation is identical for both tiers — gate is display-only,
  enforced in the API response layer.
- Conversion analytics compare blurred-score impressions to upgrades.
- Free users must not receive lower-quality scores as a side effect of the gate.

Re-evaluate the gate after Sprint 6 once conversion data is available.

---

## Success Metrics

**Primary:**

- Pearson `r ≥ 0.75` between `score` and binarized `actual_pass` on
  `n ≥ 200` beta-cohort users with self-reported exam outcomes.
- Cohort must include ≥ 3 distinct certifications to avoid easy-cert bias.

**Secondary:**

- **Calibration:** pass rate is monotonically increasing across score
  buckets `[0–25, 25–50, 50–75, 75–100]`.
- **Stability:** day-over-day score delta absent new attempts < 10 points
  for 95% of users.
- **Latency:** p95 score computation < 50 ms per user with warm Redis cache.

**Decision thresholds:**

| Result          | Action                                              |
| --------------- | --------------------------------------------------- |
| r ≥ 0.75        | Promote to v1 — productionize (Sprint 5)            |
| 0.60 ≤ r < 0.75 | Tune weights, re-evaluate; do not ship to free tier |
| r < 0.60        | Escalate to ML upgrade — open RFC-005 (Sprint 6)    |

---

## Risks

| Risk                              | Mitigation                                                             |
| --------------------------------- | ---------------------------------------------------------------------- |
| Cold start (< 10 attempts)        | `confidence < 0.2` → suppress score, show progress messaging           |
| Cert difficulty bleed-through     | Fairness check: max cross-cert mean delta 15 points before rollout     |
| Overfit to easy/popular certs     | Require ≥ 3 distinct certs in the n=200 cohort                         |
| Weight drift / silent regressions | Store `weightsVersion` in `signals` JSON; version config not constants |
| Gaming (repeat easy questions)    | Monitor in Sprint 6; consider question-difficulty weighting in v1      |

---

## Not in Scope for v0

- ML model (deferred to Sprint 6 if heuristic fails validation).
- Real-time / streaming score updates — v0 is cron + on-demand.
- Per-question difficulty weighting (IRT, Elo).
- Cross-certification transfer learning.
- Public API exposure (internal only in v0).

---

## Next

1. **Sprint 4 mid-sprint:** Tech Lead runs offline validation harness on
   `attempt_events` snapshot. Confirms four signals are computable end-to-end.
2. **Sprint 5 (if validated):** Productionize — Prisma migration for
   `ReadinessScore`, cron + on-demand recompute endpoint, UI (US-308) with
   confidence bands and tier gate.
3. **Sprint 6 (if r < 0.75 after tuning):** Open RFC-005 — Pass Predictor v1
   ML upgrade (gradient-boosted trees or logistic regression baseline).
4. **RFC-004 (Coach)** consumes `signals.contributions` as soon as
   `ReadinessScore` is in production.

---

## Approvals

- [ ] Product Owner — tier gate (D1), success metric
- [ ] Tech Lead — input contract, output model, latency target
- [ ] Backend Lead — Prisma model, cron design
- [ ] UX/QA Lead — confidence display, fairness checks
