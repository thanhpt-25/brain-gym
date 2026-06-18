# ADR-028 — Competency Scoring Algorithm

**Status:** Accepted
**Date:** 2026-06-14
**Deciders:** ThanhPT (Architect)
**Related:** [Sprint 0 Foundation Basic Design](../specs/sprint-0-foundation-basic-design.md) §5

---

## Context

The Enterprise Organization feature requires inferring a **competency level (scale 1–5)** for each person (employee or candidate) against each competency the org has defined.

After each submitted exam attempt, scores are already aggregated by domain name and stored as JSON:

- `ExamAttempt.domainScores` and `CandidateInvite.domainScores` have the shape `Record<string, { correct: number; total: number }>`, where keys are domain/category name strings.
- These are computed at submission time in `candidate.service.ts submitAttempt` and used by `org-analytics.service.ts getSkillGaps`.
- There is no per-answer table pre-joined to competencies.

The `CompetencyDomain` model (added in the competency framework sprint) maps a single competency to **multiple domain names** (matched case-insensitively).

The `QuestionCompetency` model maps a competency to individual org questions with a numeric `weight`, but is not yet populated — no UI or seed data fills it.

Two approaches were considered:

**Approach A — Recompute from raw answers via `QuestionCompetency`.**
For each competency, fetch the linked question IDs, look up the person's individual answers, and compute a weighted accuracy. More precise, but requires:
- Re-fetching raw answer records — extra I/O and joins.
- `QuestionCompetency` data to be fully populated — it is not in v0, so this approach would produce no results.

**Approach B — Aggregate `domainScores` via `CompetencyDomain` mappings.**
For each competency, fetch its mapped domain names, sum `correct`/`total` from the matching keys in `domainScores` (case-insensitive), convert to a percentage, and bucket into a level. Reuses already-stored data, requires no re-fetching of raw answers, and works immediately once the org maps a few domain names.

---

## Decision

**Approach B was selected for v0.**

Reasons:

1. **Reuses stored data** — `domainScores` already exists on every submitted attempt and candidate invite; no backfill or raw-answer re-fetch is needed. Historical attempts are scored immediately.
2. **Low configuration cost** — the org only needs to map domain names to competencies (`CompetencyDomain`), not label every individual question. This is feasible from day one; Approach A would produce empty results until `QuestionCompetency` is populated.
3. **Does not foreclose accuracy improvements** — `QuestionCompetency` remains in the schema. When sufficient question-level labels exist, the service layer can be upgraded to Approach A (or a hybrid) without changing the public function signature or the database schema.

---

## Implementation

### Pure function: `inferCompetencyLevel()`

Location: `backend/src/competency/scoring/infer-competency-level.ts`

No I/O, no database access, fully deterministic.

```ts
export interface DomainScore {
  correct: number;
  total: number;
}

export interface Threshold {
  /** Inclusive lower bound. Must be sorted descending by minPercentage. */
  minPercentage: number;
  level: number;
}

export interface InferCompetencyLevelOptions {
  scaleMin: number;
  scaleMax: number;
  thresholds: Threshold[];
  /** sumTotal threshold for HIGH confidence (default 20) */
  minSampleForHigh?: number;
  /** sumTotal threshold for MEDIUM confidence (default 8) */
  minSampleForMedium?: number;
}

export interface CompetencyLevelResult {
  level: number;          // integer in [scaleMin, scaleMax]
  percentage: number;     // 0..100, rounded to 1 decimal place
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  sampleSize: number;     // sum of total across matched domains
  matchedDomains: string[];
}

function inferCompetencyLevel(
  domainScores: Record<string, DomainScore>,
  mappedDomains: string[],
  options: InferCompetencyLevelOptions,
): CompetencyLevelResult;
```

### Algorithm

1. **Normalize** all keys in `domainScores` and all entries in `mappedDomains` by `lowercaseTrim()`.
2. **Aggregate** — for each domain in `mappedDomains` that has a matching (normalized) key in `domainScores`, add its `correct` and `total` to running sums `sumCorrect` and `sumTotal`. Record matched domain names.
3. **No-data edge case** — if `sumTotal === 0` (no domains matched, empty inputs, or all matched domains have `total === 0`), return `{ level: scaleMin, percentage: 0, confidence: 'LOW', sampleSize: 0, matchedDomains: [] }`. Division by zero never occurs.
4. **Percentage** — `percentage = round((sumCorrect / sumTotal) * 100, 1)`.
5. **Level bucketing** — iterate `thresholds` in descending order of `minPercentage`; pick the `level` of the first threshold where `percentage >= minPercentage`. If none match, use `scaleMin`. Clamp the result to `[scaleMin, scaleMax]`.
6. **Confidence** — determined independently of level, based solely on `sumTotal`:
   - `HIGH` if `sumTotal >= minSampleForHigh` (default 20)
   - `MEDIUM` if `sumTotal >= minSampleForMedium` (default 8)
   - `LOW` otherwise

### Default threshold table (scale 1–5)

| Level | Label | minPercentage (>=) | Range |
|:-----:|:------|:------------------:|:------|
| 5 | Expert | 90 | 90–100% |
| 4 | Proficient | 75 | 75–89% |
| 3 | Competent | 60 | 60–74% |
| 2 | Developing | 40 | 40–59% |
| 1 | Novice | 0 | 0–39% |

```ts
export const DEFAULT_THRESHOLDS_1_5: Threshold[] = [
  { minPercentage: 90, level: 5 },
  { minPercentage: 75, level: 4 },
  { minPercentage: 60, level: 3 },
  { minPercentage: 40, level: 2 },
  { minPercentage: 0,  level: 1 },
];
```

### Edge cases handled

| Scenario | Behavior |
|:---------|:---------|
| No domain matches / empty `domainScores` | `level=scaleMin, percentage=0, confidence=LOW, sampleSize=0` |
| Partial overlap (only some `mappedDomains` present in `domainScores`) | Only matching domains are summed; `sampleSize` reflects actual sample |
| Case / whitespace differences ("Networking" vs "NETWORKING" vs " networking ") | Normalized by `lowercaseTrim` before comparison |
| Domain present in both sets but with `total=0` | Adds 0 to `sumTotal`; only triggers no-data path if ALL matched domains have `total=0` |
| Percentage exactly on a threshold boundary (e.g. exactly 75%) | `>=` operator — rounds up to the higher level |

### Representative unit tests

```ts
const opts = { scaleMin: 1, scaleMax: 5, thresholds: DEFAULT_THRESHOLDS_1_5 };

// TC1 — multiple domains aggregated, sampleSize >= 20 → HIGH
// Networking 18/20 + Security 9/10 = 27/30 = 90.0% → level 5; sample 30 → HIGH
inferCompetencyLevel(
  { Networking: { correct: 18, total: 20 }, Security: { correct: 9, total: 10 }, Storage: { correct: 1, total: 5 } },
  ['Networking', 'Security'],
  opts,
); // => { level: 5, percentage: 90.0, confidence: 'HIGH', sampleSize: 30, matchedDomains: ['Networking', 'Security'] }

// TC2 — mapped domain not present in domainScores
inferCompetencyLevel(
  { Compute: { correct: 4, total: 5 } },
  ['Networking'],
  opts,
); // => { level: 1, percentage: 0, confidence: 'LOW', sampleSize: 0, matchedDomains: [] }

// TC3 — case-insensitive, partial overlap, small sample → LOW
// 'networking' matches 'NETWORKING'; 'Databases' not present: 3/6 = 50.0% → level 2; sample 6 < 8 → LOW
inferCompetencyLevel(
  { networking: { correct: 3, total: 6 } },
  ['NETWORKING', 'Databases'],
  opts,
); // => { level: 2, percentage: 50.0, confidence: 'LOW', sampleSize: 6, matchedDomains: ['NETWORKING'] }

// TC4 — exact boundary 75% uses >=; sampleSize 8 == minSampleForMedium → MEDIUM
inferCompetencyLevel(
  { Security: { correct: 6, total: 8 } },
  ['security'],
  opts,
); // => { level: 4, percentage: 75.0, confidence: 'MEDIUM', sampleSize: 8 }
```

The full test suite (`infer-competency-level.spec.ts`) covers 10 cases including empty inputs, whitespace trimming, `total=0` domains, custom scale, and confidence boundary at exactly `minSampleForHigh`.

### Integration with `OrgAnalyticsService`

`OrgAnalyticsService` imports `inferCompetencyLevel` and `DEFAULT_THRESHOLDS_1_5` directly. It fetches competency definitions (with their `CompetencyDomain` mappings) and the aggregated `domainScores` from member attempts, then calls `inferCompetencyLevel` per competency to produce the competency profile and heatmap responses.

---

## Consequences

### Positive

- **Works on existing data** — reuses `domainScores` already stored on all submitted attempts; no backfill, no schema change, historical data is scored immediately.
- **Pure function, easy to test** — completely decoupled from Prisma and HTTP; all branches (no-data, partial overlap, case differences, threshold boundaries, confidence levels) are covered by unit tests without a database.
- **Low org setup cost** — mapping a few domain names to a competency is sufficient to get results; labeling every question is not required.
- **No schema lock-in** — `QuestionCompetency` is preserved for a future v1 upgrade to Approach A (per-question weighted scoring) without breaking the public function signature.
- **Confidence is independent of level** — callers know when a level 4 is based on 6 questions vs. 40, which is important for hiring decisions.

### Risks and mitigations

- **Mapping quality dependency** — incorrect or missing domain mappings produce skewed or zero scores. Mitigation: surface `confidence: LOW` and `sampleSize: 0` clearly in the UI; validate that mapped domain names match known domains when saving.
- **Domain aggregation is unweighted** — all domains in a competency contribute equally per question answered, regardless of the `weight` field on `QuestionCompetency`. Acceptable for v0 screening use cases; Approach A addresses this in v1.
- **Default thresholds fixed for scale 1–5** — orgs using a different scale need a custom threshold table. Mitigation: `thresholds` is a function parameter (not hardcoded); v0 restricts orgs to scale 1–5 until a threshold-management UI is built.
- **Discrete levels cause ties** — many candidates may share the same integer level. Mitigation: use `percentage` (continuous) as a secondary sort key in ranking views.
