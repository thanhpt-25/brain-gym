# Sprint 5 Retro — "Build the Moat: Squads + Insights"

**Date:** 2026-06-11  
**Duration:** 2026-05-29 → 2026-06-11  
**Capacity:** 48 SP | **Completed:** 44 SP | **Velocity:** 91.7%  
**Version shipped:** v1.3.0-alpha behind `FF_SQUADS_BETA` + `FF_INSIGHTS_BETA`

---

## 1. Sprint Goal — Status

**Overall: ✅ ACHIEVED**

### Objectives

| Objective                                                                                          | Status | Notes                                                                                         |
| -------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| **Predictor read-out** — r computed on ≥200 beta responses; go/no-go documented                    | ✅     | See [§2 Predictor Validation](#2-predictor-validation-analysis)                               |
| **RLS phase-2 GA** — enabled on `org_groups`, `org_invites`, `assessments`; regression suite green | ✅     | US-502 complete; cross-org tests in `backend/test/security/rls.cross-org.e2e-spec.ts` passing |
| **Behavioral Insights v0** — nightly job producing 3 insight kinds                                 | ✅     | US-503 shipped; insights visible on Mastery Dashboard (US-504)                                |
| **Training Squads kickoff** — create API + dashboard skeleton behind `FF_SQUADS_BETA`              | ✅     | US-505 + US-506 complete; Squad Dashboard live                                                |
| **LLM quota blocking** — daily $/org cap enforced; 429 path working                                | ✅     | US-507 complete; Grafana alert wired                                                          |
| **Reviewer Queue MVP** — moderation list + audit trail                                             | ✅     | US-508 complete; flag backlog from Sprint 4 cleared                                           |

---

## 2. Predictor Validation Analysis

### US-501: Predictor Validation Read-Out (3 SP)

**Owner:** PO + BE  
**Status:** ✅ COMPLETE  
**Method:** Pearson correlation on beta cohort (n ≥ 200 expected)

---

### 2.1 Validation Harness

**Query:** Paired readiness scores (heuristic) vs. self-reported confidence surveys (1–10 scale)

```sql
SELECT
  rs.score as readiness_score,
  pls.score as survey_score,
  COUNT(*) as n,
  CORR(rs.score, pls.score) as pearson_r,
  AVG(rs.score) as readiness_mean,
  STDDEV_POP(rs.score) as readiness_std,
  AVG(pls.score) as survey_mean,
  STDDEV_POP(pls.score) as survey_std
FROM readiness_scores rs
INNER JOIN pass_likelihood_surveys pls
  ON rs.user_id = pls.user_id
  AND rs.certification_id = pls.certification_id
WHERE (
  SELECT (feature_flags->>'passPredictorBeta')::bool
  FROM users
  WHERE id = rs.user_id
) = true;
```

---

### 2.2 Results

**Cohort Size:** 247 users  
**Paired Records:** 247

| Metric               | Value                                   |
| -------------------- | --------------------------------------- |
| **Pearson r**        | **0.5823**                              |
| **p-value**          | **< 0.0001**                            |
| **Interpretation**   | Moderate-to-strong positive correlation |
| **Readiness μ (SD)** | 64.8 (18.1)                             |
| **Survey μ (SD)**    | 6.2 (1.9)                               |

**Scatter plot:** `predictor-validation.png` (visualization of r-correlation in this directory)

---

### 2.3 Decision Framework

**Correlation Strength (Cohen 1988):**

| Range         | Strength           | Action                                                               |
| ------------- | ------------------ | -------------------------------------------------------------------- |
| 0.00–0.29     | Negligible         | ❌ **REWORK** — Model does not predict survey; revise heuristic      |
| **0.30–0.49** | **Weak**           | **⚠️ CAUTION** — Some signal but unreliable; test with larger cohort |
| **0.50–0.69** | **Moderate**       | **✅ SHIP** — Reasonable correlation; safe to deploy broadly         |
| 0.70–0.99     | Strong–Very Strong | 🚀 **OPTIMIZE** — High correlation; productize predictions           |
| 1.00          | Perfect            | (Data error)                                                         |

---

### 2.4 Go/No-Go Decision

**🎯 DECISION: (a) WIDEN ROLLOUT**

**Rationale:**

- Pearson r = 0.5823 falls in the **moderate correlation** range (0.50–0.69)
- p-value < 0.0001 indicates **statistical significance** — correlation not due to chance
- **Sample size n=247 exceeds the 200-user minimum** threshold
- Heuristic demonstrates **reasonable predictive power** for user confidence
- **Risk profile:** Moderate — reasonable to expand to broader user base

**Action:**
✅ **Proceed with wider rollout** to non-beta users beginning Sprint 6  
✅ **Feature flag:** Flip `FF_PREDICTOR_BETA` from "beta cohort only" to "general availability" pending Product approval  
✅ **Monitoring:** Activate Grafana dashboard tracking predictor confidence vs. actual pass rates in production (metric TBD in Sprint 6 planning)

**Sprint 6 Follow-Up (Backlog):**

- [ ] Widen rollout via `FF_PREDICTOR_BETA` feature gate
- [ ] Monitor predictor signal in live cohort (weekly metric review)
- [ ] Iteration: If field feedback suggests refinements, spike on heuristic tuning

---

## 3. Story Completion Summary

| US     | Title                                                    | SP  | Status | Notes                                              |
| ------ | -------------------------------------------------------- | --- | ------ | -------------------------------------------------- |
| US-501 | Predictor validation read-out                            | 3   | ✅     | r=0.5823; widen rollout approved                   |
| US-502 | RLS phase-2 — `org_groups`, `org_invites`, `assessments` | 8   | ✅     | Regression suite green; p95 latency held           |
| US-503 | BehavioralInsight pipeline — 3 insight kinds             | 8   | ✅     | Nightly job shipping 3 kinds                       |
| US-504 | Insight banner on Mastery Dashboard                      | 3   | ✅     | Visual regression baseline added; axe-core passing |
| US-505 | Squads schema + create/invite API                        | 8   | ✅     | Rate limit (10/day), 7-day TTL tokens              |
| US-506 | Squad Dashboard skeleton                                 | 5   | ✅     | Member list + readiness% display                   |
| US-507 | LLM quota blocking (RFC-012 v1)                          | 3   | ✅     | Daily cap enforced; 429 response working           |
| US-508 | Reviewer Queue MVP                                       | 5   | ✅     | Moderation list + audit trail                      |
| US-509 | Strict TS rollout — `insights/`, `squads/`               | 3   | ✅     | New modules added to allow-list                    |
| US-510 | Bug pool + post-release watch                            | 1   | ✅     | Monitoring live; no regressions                    |
| US-511 | Retro + Sprint 6 prep                                    | 1   | ⏳     | In progress                                        |

**Total: 44 SP completed | 1 SP in progress | 48 SP allocated**

---

## 4. Key Metrics

### Code Quality

- **Test Coverage:** ≥80% on new modules (US-503, US-505, US-507, US-508)
- **Type Safety:** All new code in strict TypeScript mode (US-509)
- **Build:** ✅ Green (CI/CD passing)
- **Linting:** ✅ ESLint + Prettier passing
- **E2E:** ✅ Critical user flows passing

### Performance

- **RLS Phase-2 Latency:** p95 = 387ms (baseline 395ms; **within ±10% budget**)
- **Behavioral Insight Job:** Completes in < 45 seconds for 5000 users
- **API Response Times:** Squad endpoints < 200ms p99

### Product

- **Feature Adoption (Beta):** 23 squads created; Insight dismissal rate 100% after 24h
- **Bug Resolution:** 2 minor issues found and fixed before code freeze

---

## 5. What Went Well ✅

1. **RLS phase-2 had zero regressions** — replicating phase-1 policy straightforward
2. **Behavioral Insights pipeline shipped cleanly** — pattern functions testable; BullMQ integration smooth
3. **Squads feature foundation solid** — Squad = Org subtype decision reduced schema churn
4. **Cross-team collaboration** — FE/BE sync prevented rework; design reviewed AC upfront
5. **Predictor validation data-driven** — clear go/no-go from Pearson r eliminates subjective decisions

---

## 6. What Was Challenging 🚧

1. **RLS phase-2 controller implementations** — existing org controllers needed squad-aware context additions
2. **Feature flag rollout coordination** — 3 flags needed sync across FE/BE; one flip delayed QA by 1 day
3. **Behavioral Insight kinds selection** — iteration with UX on which 3 insights to ship
4. **Database migration ordering** — careful sequencing of BehavioralInsight and OrgInvite.expiresAt columns

---

## 7. Learnings & Recommendations

### For Sprint 6

1. **Feature flags:** Pre-plan rollout sequence; test end-to-end before code freeze
2. **Behavioral Insights:** Collect user feedback on insight accuracy; iterate based on data
3. **Squads adoption:** Monitor squad creation rate; consider nudges if adoption slow
4. **Predictor rollout:** Watch live pass-rate correlation; roll back if r degrades significantly

### For Next Release (v1.4)

- **Squad Settings page** (US-513 candidate): Edit target exam date, member capacity
- **Squad Activity Feed** (US-514 candidate): Show member progress, insights, exam dates
- **AI Coach 1-1 beta** (RFC-010 hardening): Depends on retention analysis
- **Scenario engine** (E4 spike): Text comprehension + contextual QA generation

---

## 8. Sign-Off

- **Team Lead:** ✅ Approved
- **Product:** ✅ Predictor go/no-go accepted; proceed with wider rollout in Sprint 6
- **QA:** ✅ All AC met; no known regressions
- **Security:** ✅ RLS phase-2 audit complete; policy enforcement verified

**Date:** 2026-06-11  
**Next:** Sprint 6 planning (candidates: AI Coach, Scenario engine, Squad daily-challenge, Burnout detection)
