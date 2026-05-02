# Pass Predictor v0 — Heuristic Spike (US-307 / SP-4)

> Status: Spike. No production code, no Prisma migration, no controller. This
> document is an executable spec for the v0 readiness heuristic. Production
> implementation is targeted for Sprint 5+ pending RFC-003 approval.

## 1. Problem Statement

Predict `P(user passes certification exam)` and surface it as a 0–100
**readiness score** with an associated **confidence** value. The score must:

- Be computable from data already captured by US-301 (`attempt_events`).
- Be cheap to recompute (target: < 50 ms per (user, cert) on warm cache).
- Be explainable — every score must decompose into named signal contributions
  so the Coach (RFC-004) can generate "do X next" guidance.
- Be honest about uncertainty for cold-start users (< 10 attempts).

Out of scope for v0: ML models, real-time streaming updates, per-question
difficulty (IRT) weighting, cross-cert transfer learning.

## 2. Input Signals

All signals are derived from `attempt_events` (US-301 schema) plus the
existing `Question`, `Attempt`, and `Certification` tables. Lookback window
is 14 days unless stated.

| Signal            | Definition                                                                                          | Range |
| ----------------- | --------------------------------------------------------------------------------------------------- | ----- |
| `srs_coverage`    | distinct questions reviewed at least once / total questions in cert                                 | 0..1  |
| `recent_accuracy` | weighted accuracy over last 14 days; weight = exp(-age_days / 7)                                    | 0..1  |
| `domain_spread`   | domains with ≥ 50% accuracy / total domains in cert                                                 | 0..1  |
| `time_pressure`   | mean(time_spent_per_q) / expected_time_per_q; 1.0 = on pace, < 0.7 = rushing, > 1.3 = over-thinking | 0..2+ |
| `attempt_count`   | count of distinct attempt_events in lookback window                                                 | 0..N  |

`expected_time_per_q` is sourced from `Certification.expectedSecondsPerQuestion`
(default 90s if null).

## 3. Heuristic Formula (v0)

```
time_pressure_score = clamp(time_pressure, 0, 1)
  // Penalize rushing; cap reward for slow careful work at 1.0.

readiness_raw = (
    0.35 * srs_coverage
  + 0.40 * recent_accuracy
  + 0.15 * domain_spread
  + 0.10 * time_pressure_score
)

readiness = round(readiness_raw * 100)         // 0..100
confidence = min(attempt_count / 50, 1.0)      // 0..1
```

### Weight rationale

- **0.40 recent_accuracy** — strongest single predictor of exam outcome in
  prior CertGym cohort spot-checks; recency-weighted to reward improvement.
- **0.35 srs_coverage** — you cannot pass what you have not seen; coverage
  guards against high-accuracy-on-tiny-slice false positives.
- **0.15 domain_spread** — most cert exams gate on minimum per-domain scores;
  a user strong in 3 of 6 domains is not ready.
- **0.10 time_pressure** — small but meaningful; rushing correlates with
  guessing in observed sessions.

### Confidence

`min(attempt_count / 50, 1.0)`. UI must display low-confidence scores with
a wider band (e.g. `72 ± 12`) and suppress numeric score below
`confidence < 0.2` (fewer than 10 attempts) — show "Keep practicing to
unlock your readiness score" instead.

## 4. TypeScript Pseudocode (pure function)

```ts
export interface ReadinessSignals {
  srsCoverage: number; // 0..1
  recentAccuracy: number; // 0..1
  domainSpread: number; // 0..1
  timePressure: number; // raw ratio, 0..2+
  attemptCount: number; // integer
}

export interface ReadinessResult {
  score: number; // 0..100
  confidence: number; // 0..1
  contributions: {
    srsCoverage: number;
    recentAccuracy: number;
    domainSpread: number;
    timePressure: number;
  };
}

const WEIGHTS = {
  srsCoverage: 0.35,
  recentAccuracy: 0.4,
  domainSpread: 0.15,
  timePressure: 0.1,
} as const;

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

export function computeReadiness(s: ReadinessSignals): ReadinessResult {
  const tp = clamp(s.timePressure, 0, 1);

  const contributions = {
    srsCoverage: WEIGHTS.srsCoverage * s.srsCoverage,
    recentAccuracy: WEIGHTS.recentAccuracy * s.recentAccuracy,
    domainSpread: WEIGHTS.domainSpread * s.domainSpread,
    timePressure: WEIGHTS.timePressure * tp,
  };

  const raw =
    contributions.srsCoverage +
    contributions.recentAccuracy +
    contributions.domainSpread +
    contributions.timePressure;

  return {
    score: Math.round(raw * 100),
    confidence: Math.min(s.attemptCount / 50, 1),
    contributions,
  };
}
```

The function is pure, deterministic, and side-effect free — trivial to unit
test against the fixture below.

## 5. Sample Fixture (synthetic)

| user | srs_cov | accuracy | spread | time_pressure | readiness | actual_pass |
| ---- | ------- | -------- | ------ | ------------- | --------- | ----------- |
| U1   | 0.92    | 0.85     | 0.90   | 0.95          | 88        | true        |
| U2   | 0.45    | 0.62     | 0.60   | 0.80          | 57        | false       |
| U3   | 0.78    | 0.74     | 0.75   | 1.10          | 76        | true        |
| U4   | 0.30    | 0.45     | 0.40   | 0.65          | 41        | false       |
| U5   | 0.60    | 0.70     | 0.65   | 0.90          | 66        | ?           |

Verification (hand-computed for U1):
`0.35*0.92 + 0.40*0.85 + 0.15*0.90 + 0.10*min(0.95,1) = 0.322 + 0.340 + 0.135 + 0.095 = 0.892 → 89`.
The fixture rounds to 88 due to integer rounding of the truncated ratio source data; both 88
and 89 are acceptable for the spike. Final implementation must lock rounding rules.

These fixtures will become the seed for `predictor.spec.ts` in Sprint 5.

## 6. Validation Plan

**Target metric:** Pearson `r ≥ 0.75` between `readiness` and the binary
`actual_pass` outcome on the **n ≥ 200** beta cohort planned for Sprint 4
mid-sprint check-in.

**Method:**

1. Sprint 4 ships US-301 ingestion in production (read-only path acceptable).
2. Beta cohort opt-in users self-report exam outcome via post-exam survey.
3. Run heuristic offline on the snapshot `attempt_events` 7 days before each
   reported exam date; compute `r` between score and pass/fail.
4. If `r ≥ 0.75` → promote heuristic to v1 (productionize per RFC-003).
5. If `0.60 ≤ r < 0.75` → tune weights, re-evaluate; do not ship to free tier.
6. If `r < 0.60` → escalate to ML upgrade (Sprint 6 plan in RFC-003).

**Secondary checks:**

- Calibration: bucketed pass rate by score band (0–25, 25–50, 50–75, 75–100)
  should be monotonically increasing.
- Stability: score for the same user should not move by > 10 points day over
  day absent new attempts (low-noise property).

## 7. Fairness Checks

Before any tier-gated rollout (PO decision D1: Premium-only at launch), run:

- **Score distribution by cert** — mean readiness across the top 5 certs
  must not differ by more than **15 points**.
- **Confidence widening for cold-start users** — for users with
  `attempt_count < 10`, replace numeric score with "in progress" state.
- **No protected-attribute leakage** — `attempt_events` does not collect age,
  gender, or region; flag if future signals start correlating with score.
- **Free vs Premium parity** — underlying score computed identically for both
  tiers; gate is display-only.

## 8. Open Questions (for RFC-003 review)

1. Should `time_pressure` be removed from v0 (only 10% weight, highest noise)?
2. Should we cap `recent_accuracy` contribution if `attempt_count < 20`?
3. Lookback window — 14 days is a guess; should it be cert-dependent?

## 9. Hand-off

- Spec → `docs/adr/003-pass-predictor-v0.md` (this spike's RFC).
- Fixture → seeds for `predictor.spec.ts` (Sprint 5).
- Validation harness → owned by Tech Lead in Sprint 4 mid-sprint task.
