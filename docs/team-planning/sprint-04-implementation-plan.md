# Sprint 4 — "Predictor Goes Live" Implementation Plan

- **Version target:** v1.2.0 (GA)
- **Capacity:** 48 SP (velocity bump per [02-scrum-master.md §1.2](./02-scrum-master.md))
- **Window:** 2026-05-15 → 2026-05-28 (2 weeks)
- **Status as of 2026-05-10:** Pre-sprint prep complete. **US-408 (Predictor harness + beta opt-in) fully implemented, verified, and CI-passing** (all lint, type checks, tests, Lighthouse green). All database migrations applied. Backend & frontend stacks healthy. Ready for team sprint execution starting 2026-05-15.
- **Sprint goal:** Ship Pass Predictor v1 (Readiness Score + domain breakdown) to a 200-user premium beta, wire Adaptive Weakness suggest, land Time Pressure Mode, start Postgres RLS rollout, and put an LLM cost ceiling around AI gen + Coach prep work.

**Pre-Sprint Readiness:**

- ✅ **US-408 complete:** Database schema, backend, frontend, and validation harness all verified in Docker
- ✅ **Migrations healthy:** All schema changes applied cleanly; database constraints validated
- ✅ **Documentation current:** Privacy audit, sprint plan, and predictor validation guide updated
- ✅ **Stack operational:** Full Docker environment running (backend, frontend, postgres, redis, nginx all healthy)
- ⏳ **Awaiting:** PO to provide 200-user beta cohort email list for seeding

Source artefacts:

- [00-master-roadmap.md §Sprint 1–4 / Decision D6](./00-master-roadmap.md)
- [01-product-owner.md §3 Backlog NOW / §4 v1.2](./01-product-owner.md) — US-001, US-002, US-005, US-006
- [03-tech-lead.md RFC-003, RFC-006, RFC-012, RFC-009](./03-tech-lead.md)
- [04-ux-qa-lead.md §Editorial + Dark luxury, axe gate, perf budget](./04-ux-qa-lead.md)
- [sprint-03-implementation-plan.md §Exit Checklist](./sprint-03-implementation-plan.md)

---

## 1. Sprint Goal & Demo

**Goal Hit Criteria:**

- Readiness Score 0–100 visible on Mastery Dashboard for the 200-user beta cohort (premium-only flag).
- RFC-003 GA: `ReadinessScore` model written by a scheduled job consuming `attempt_events`; recompute SLA <2s after a session per US-001 AC.
- Adaptive Weakness suggestion (US-006) live on dashboard, sourced from per-domain proficiency.
- Time Pressure Mode (US-005) shippable behind toggle in `/exam` setup.
- RFC-006 phase-1 lands: RLS enabled on **2 high-risk tables** (`org_members`, `org_questions`), with regression suite proving cross-org reads are blocked.
- RFC-012 v0: `LlmUsageEvent` recorded for every AI gen + future Coach call; per-org daily quota enforceable (warn-only this sprint).
- Predictor accuracy harness reports Pearson **r** vs. self-reported pass-likelihood survey on beta cohort (validation, not pass/fail this sprint).

**Demo script (Tue, end of S4):**

1. Beta user logs in → Mastery Dashboard now shows Readiness Score gauge + domain breakdown + "Next topic to study" card.
2. Take a 10-question session → Score recomputes <2s, signals JSON visible in dev panel.
3. Switch cert to one with <50 attempts → "Need 50+ questions to unlock" empty state per US-001 AC.
4. Open `/exam` → toggle **Time Pressure Mode** (65q / 90min) → timer + warning state demoed.
5. Ops view: Grafana panel showing `llm_usage_events` $/user/day + RLS denial counter from Postgres logs.
6. Predictor harness notebook: r-correlation chart on 200-user beta survey responses.

---

## 2. Story Breakdown (48 SP)

| ID     | Title                                               | SP  | Owner             | Lane       | Depends                  |
| ------ | --------------------------------------------------- | --- | ----------------- | ---------- | ------------------------ |
| US-401 | RFC-003 GA — `ReadinessScore` model + compute job   | 8   | Senior BE         | Foundation | S3 AttemptEvent pipeline |
| US-402 | Readiness Score UI on Mastery Dashboard (US-001)    | 5   | Senior FE + UX    | Feature FE | US-401, tokens (S3)      |
| US-403 | Domain breakdown drill-down (US-002)                | 5   | FE + UX           | Feature FE | US-402                   |
| US-404 | Adaptive Weakness "next topic" suggest (US-006)     | 5   | BE + FE           | Feature    | US-401                   |
| US-405 | Time Pressure Mode (US-005)                         | 5   | Senior FE         | Feature FE | —                        |
| US-406 | RFC-006 phase-1 — RLS on 2 tables                   | 8   | Security Champion | Foundation | —                        |
| US-407 | RFC-012 v0 — `LlmUsageEvent` + warn-only quota      | 5   | Platform          | Foundation | BullMQ (S2)              |
| US-408 | Predictor accuracy harness + 200-user beta opt-in   | 3   | BE + PO           | Spike      | US-401                   |
| US-409 | RFC-009 strict TS rollout to `events/` + `mastery/` | 3   | Senior FE         | Tech debt  | S3                       |
| US-410 | Bug pool + support                                  | 3   | Whole team        | Buffer     | —                        |
| US-411 | Retro action items execution                        | 3   | SM                | Process    | —                        |

Total: **53 SP raw → 48 SP after capacity match.** US-410/411 absorb spillover; if US-406 RLS is dragging by Day 6, descope to **1 table** (`org_members`) and roll the second to Sprint 5.

---

## 2a. Pre-Sprint Status (as of 2026-05-10)

**Completed & Verified:**

- **US-408** (3 SP) ✅ — Predictor accuracy harness + 200-user beta opt-in
  - Prisma migration applied; `pass_likelihood_surveys` table created with all constraints
  - Feature flags JSONB column added to users table
  - Backend PassLikelihoodController endpoints wired and mapped (`POST` / `GET`)
  - Frontend PassLikelihoodSurveyBanner component built and integrated into MasteryPage
  - Survey validation notebook (`backend/scripts/predictor-validation.md`) authored
  - Privacy audit documentation updated (`docs/security/privacy-events.md`)
  - Database constraints validated (unique, check, FK all working)
  - Docker stack fully operational; all migrations applied cleanly
  - **Ready for:** PO to provide 200-user beta cohort email list → seeding via `seed-beta-cohort.ts`

**Pending (start of sprint):**

- **US-401** — RFC-003 GA `ReadinessScore` compute job (ready for kickoff, BE)
- **US-402** — Readiness Score UI on Mastery Dashboard (ready for integration with US-401)
- **US-403** — Domain breakdown drill-down (pending US-402)
- **US-404** — Adaptive Weakness suggest (pending US-401)
- **US-405** — Time Pressure Mode (independent, ready)
- **US-406** — RLS phase-1 on 2 tables (independent, ready)
- **US-407** — LLM usage events + quota (independent, ready)
- **US-408** — Beta cohort seeding (waiting on PO email list; code complete & CI green; unblock on Mon Day 9)
- **US-409** — Strict TS rollout (independent, ready)
- **US-410/411** — Bug pool + retro (buffer)

---

## 3. Day-by-Day Plan

### Week 1 (2026-05-15 → 05-21)

| Day | Focus                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------- |
| Wed | Planning 90'. PO confirms 200-user beta cohort list. RFC-003 final review. RFC-006 scope locked to 2 tables.    |
| Thu | BE: US-401 `ReadinessScore` migration + cron skeleton. FE: US-402 ReadinessGauge component + Storybook.         |
| Fri | RFC-003 + RFC-012 ADRs merged. US-407 `LlmUsageEvent` schema. RFC-006 RLS policies drafted on local Postgres.   |
| Mon | US-401 compute job hooked to BullMQ (recompute on `SUBMITTED` event). US-405 Time Pressure timer state machine. |
| Tue | US-402 wired to API; loading + empty + error states. US-406 RLS migration on staging behind feature flag.       |
| Wed | Refinement. US-403 domain drill-down + Figma diff. US-408 survey deployed to 200 cohort.                        |
| Thu | Design review. US-404 suggest endpoint live. axe gate run on new pages; visual baseline updated.                |

### Week 2 (2026-05-22 → 05-28)

| Day | Focus                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------- |
| Fri | Cross-org RLS regression suite green. k6 perf re-run with RLS enabled (latency budget guard).                     |
| Mon | US-405 Time Pressure end-to-end. US-407 quota dashboard wired in Grafana. US-409 strict TS rollout merged.        |
| Tue | Code freeze. axe + visual + e2e gates green. Demo dry run with PO. Beta cohort emails go out.                     |
| Wed | Release v1.2.0 to production behind `pass_predictor_beta` flag (200 users). Monitor recompute SLA.                |
| Thu | Sprint Review + Retro. PO writes release note + beta survey kickoff. Sprint 5 prep (Squads, Behavioral Insights). |

---

## 4. Story Implementation Notes

### US-401 — RFC-003 GA: `ReadinessScore` compute job (8 SP, BE)

Acceptance:

- `ReadinessScore` model per [03-tech-lead.md L159–171](./03-tech-lead.md). Migration reversible; index `(certificationId, score)` for cohort queries.
- BullMQ job `readiness:recompute` triggered on every `SUBMITTED` AttemptEvent (debounced 5s per `(userId, certificationId)`).
- Heuristic per RFC-003 spec landed in S3: weighted blend of `srsCoverage`, `recentAccuracy14d`, `domainSpread`, `timePressure`. Pure function in `backend/src/insights/readiness/heuristic.ts` — 100% branch coverage.
- Recompute p95 <2s end-to-end (ingress event → row written) on staging with the seeded 1k-event fixture.
- Confidence score: `min(1, attempts/100)` capped at 0.95 (premature precision sentinel).
- Feature-flagged behind `FF_PREDICTOR_BETA=true`; off in production until Wed Day 13.

Files:

- `backend/prisma/schema.prisma` (+`ReadinessScore`)
- `backend/src/insights/readiness/heuristic.ts`
- `backend/src/insights/readiness/readiness.processor.ts`
- `backend/src/insights/readiness/readiness.service.ts`
- `backend/test/insights/readiness.e2e-spec.ts`

### US-402 — Readiness Score UI on Mastery Dashboard (5 SP, FE + UX)

Acceptance — see US-001 in [01-product-owner.md L62–76](./01-product-owner.md):

- `<ReadinessGauge />` replaces the S3 placeholder hero on `/dashboard/mastery`.
- Score 0–100 + label (Not Ready 0–49 / Borderline 50–69 / Ready 70–84 / Strong 85–100).
- Hover info icon → popover with formula breakdown (accuracy × coverage × recency × difficulty).
- Empty state for `<50` attempts: "Need 50+ questions to unlock" + linear progress bar.
- Reduced-motion respected (transform/opacity only); both light editorial + dark luxury intentional.
- Visual regression baseline: 320 / 768 / 1440 × light + dark.
- Free users: blurred gauge + "Unlock with Premium" CTA per Decision D1.

Files:

- `src/components/mastery/ReadinessGauge.tsx`
- `src/components/mastery/ReadinessFormulaPopover.tsx`
- `src/services/readiness.ts`
- `src/pages/Dashboard/MasteryPage.tsx` (replace placeholder hero)

### US-403 — Domain breakdown drill-down (5 SP, FE + UX)

Acceptance — see US-002:

- Click on `<ReadinessGauge />` opens a `<DomainBreakdownDrawer />` (right-side drawer, focus-trapped, ESC to close).
- Per-domain row: name, accuracy %, coverage %, weight, "Practice this domain" CTA → routes to `/srs/today?domain=<id>`.
- Sort by lowest score first (the failing domains are the actionable ones).
- Visual regression baseline added.
- a11y: `role="dialog"`, `aria-labelledby`, return focus to gauge on close.

### US-404 — Adaptive Weakness suggest (5 SP, BE + FE)

Acceptance — see US-006:

- New endpoint `GET /api/v1/insights/next-topic?certificationId=<id>` → returns `{ domain, reason, sampleQuestionId }`.
- Logic: pick the lowest-proficiency domain with ≥10 attempts; tie-break by oldest last-seen.
- Frontend `<NextTopicCard />` on Mastery Dashboard, below Readiness Gauge.
- Click "Start practice" → routes to `/srs/today?domain=<id>` filtered to 10 questions.
- Empty state when proficiency is uniform: "You're well-rounded — try a full timed exam".

### US-405 — Time Pressure Mode (5 SP, FE)

Acceptance — see US-005 in [01-product-owner.md §3](./01-product-owner.md):

- `/exam/setup` toggle "Time Pressure Mode": 65 questions / 90 minutes (vs default 130/180).
- Timer warning state at 25% / 10% / 5% remaining (color + `aria-live="polite"` announcement).
- Reduced-motion: pulse animation off; static color change only.
- Result page tags the attempt `mode=TIME_PRESSURE` (existing `ExamAttempt.mode` column).
- E2E: full attempt round-trip in time-pressure mode green.

### US-406 — RFC-006 phase-1: RLS on 2 tables (8 SP, Security Champion + BE)

Acceptance:

- RLS enabled on `org_members`, `org_questions`. Policy: `current_setting('app.org_id')::uuid = org_id`.
- Nest interceptor sets `SET LOCAL app.org_id` per request from `OrgGuard` context. Connection-pool safe (per-request transaction).
- Regression suite: 30 cross-org test cases (read/write/list) — every one expected to return 0 rows / `RLSError`.
- k6 perf re-run with RLS — p95 latency must stay within ±10% of pre-RLS baseline (guardrail: <400ms).
- Rollback path documented: `ALTER TABLE … DISABLE ROW LEVEL SECURITY` in single migration.
- Closes risk **Multi-tenant data leak (P×I L×H)** for the two highest-traffic org tables; remaining tables tracked for Sprint 5.

Files:

- `backend/prisma/migrations/<ts>_rls_phase1/`
- `backend/src/common/rls.interceptor.ts`
- `backend/test/security/rls.cross-org.e2e-spec.ts`
- `docs/security/rls-rollout.md`

### US-407 — RFC-012 v0: LLM cost layer (5 SP, Platform)

Acceptance:

- `LlmUsageEvent { userId, orgId?, feature, modelId, inputTokens, outputTokens, costUsd, createdAt }` per [03-tech-lead.md L211–217](./03-tech-lead.md).
- Every AI gen call writes one event (existing `QuestionGenerationJob` already tracks tokens — wire into ledger).
- Per-org daily quota check: if exceeded, **warn-only** this sprint (log + metric, no block). Block toggles in Sprint 5.
- Grafana panel: `cost_usd / premium_user / day` (guardrail target <$1.20).
- Coach prep: ledger contract is consumable by future Coach feature (Sprint 5+).

### US-408 — Predictor accuracy harness + beta opt-in (3 SP, BE + PO)

Spike-style:

- `backend/scripts/predictor-validation.md` notebook: pulls scores from `readiness_scores` and self-reported pass-likelihood from a survey table; computes Pearson **r**, plots scatter.
- 200-user beta cohort flagged via `User.featureFlags.passPredictorBeta = true`. PO supplies the list (see Decision D6).
- Survey: simple 1–10 "How likely are you to pass on first try?" on dashboard banner; one response per user per cert.
- **No production gating on r yet.** Sprint 5 retro decides whether to widen rollout based on n≥200 + r.

### US-409 — Strict TS rollout to `events/` + `mastery/` (3 SP, Senior FE)

Acceptance:

- Add `events/` and `mastery/` (FE) + `insights/readiness/` (BE) to the strict-TS allow-list.
- ESLint `no-new-any` rule unchanged; remove existing `any` in those modules (cap: keep diff under 200 LOC; if larger, file ticket and stop).
- RFC-009 rollout doc updated with module-by-module status table.

### US-410 — Bug pool + support (3 SP)

Reserve. Triage daily. Beta-launch monitor on call (release Wed): on-call eng watches recompute SLA + RLS denial logs for 24h post-release.

### US-411 — Retro action items (3 SP, SM)

From Sprint 3 retro (carry-over candidates):

- Linear board hygiene (predictor cards labelled).
- Schedule of Sprint 5 backlog refinement on Mon Day 9.
- RFC-009 status table updated.
- Beta cohort comms (release email + survey link) sent Tue Day 13.

---

## 5. Cross-cutting Engineering Tasks

| Task                                                     | Owner     | Notes                                                                       |
| -------------------------------------------------------- | --------- | --------------------------------------------------------------------------- |
| Feature flag service: `FF_PREDICTOR_BETA` per-user gate  | Platform  | Reuse existing `User.featureFlags` JSON column; no new infra                |
| Privacy doc updated for `LlmUsageEvent`                  | Tech Lead | One-pager checked into `docs/security/privacy-events.md`                    |
| Premium-gate on Mastery Dashboard hero (Decision D1)     | FE        | Free users see blurred gauge + CTA — does not break existing free dashboard |
| Survey table + endpoint                                  | BE        | Minimal: `PassLikelihoodSurvey { userId, certId, score, submittedAt }`      |
| RLS observability: Postgres log → Grafana denial counter | Platform  | Required guardrail for safe Sprint 5 expansion                              |

---

## 6. Definition of Ready / Done

**DoR (per story):**

- AC written and reviewed by PO; RFC/ADR linked for any schema change.
- Test plan named (unit / integration / e2e / visual / perf).
- Owner + reviewer assigned. Feature-flag plan stated where user-visible.

**DoD (per story):**

- Code merged to `main` via PR with green CI (lint + typecheck + unit + e2e + axe + visual).
- ≥80% coverage on new code; total coverage not down >1%.
- Docs updated where touched (RLS rollout doc, RFC-009 status table, etc.).
- Demo-able on staging behind correct feature flag.
- No CRITICAL/HIGH from `code-reviewer` or `security-reviewer` agent open.
- Beta-impacting stories: rollback plan written.

---

## 7. Risks & Mitigations (Sprint 4 specific)

| Risk                                                                            | P×I | Mitigation                                                                                              | Owner             |
| ------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------- | ----------------- |
| Predictor heuristic correlation r < 0.3 on beta survey                          | M×H | Sprint 4 ships UI behind flag; Sprint 5 retro decides widen vs. rework. Survey is validation, not gate. | PO + BE           |
| RLS interceptor breaks pooled connections / leaks `app.org_id` between requests | M×H | Per-request transaction wrapper; load test + cross-org regression suite must pass before staging merge  | Security Champion |
| Recompute SLA breached when `attempt_events` >1M rows                           | M×M | Debounce 5s per (user, cert); index already in place; partition table monthly per Tech Lead §4          | Senior BE         |
| Adaptive suggest gives same domain repeatedly → user frustration                | L×M | Tie-break by oldest-last-seen; cap "same suggestion" at 3 consecutive sessions, then rotate             | BE                |
| Time Pressure Mode timer drift on backgrounded tab                              | M×M | Server-authoritative deadline (existing pattern in exam engine); client just renders                    | Senior FE         |
| LLM ledger writes add latency to AI gen path                                    | L×M | Async write via BullMQ; ledger failure logs but does not block job                                      | Platform          |
| Free-user blurred gauge looks broken / confusing                                | M×L | UX review with PO before Code Freeze; copy + CTA tested on 5 internal users                             | UX/QA             |

---

## 8. Capacity & Allocation

| Role              | Capacity (SP) | Allocated                                       |
| ----------------- | ------------- | ----------------------------------------------- |
| Senior BE         | 11            | US-401 (8), US-404 BE half (3)                  |
| BE                | 9             | US-407 (5), US-408 (3), US-410 (1)              |
| Senior FE         | 11            | US-402 (5), US-405 (5), US-409 (1)              |
| FE                | 9             | US-403 (5), US-404 FE half (2), US-409 (2)      |
| UX/QA             | 5             | US-402/403 design (3), axe + visual (2)         |
| Security Champion | 3             | US-406 (3 — pairs with Senior BE for migration) |
| SM                | —             | US-411 (3), facilitation, beta comms            |
| **Total**         | **48**        |                                                 |

20% buffer is implicit in US-410 (3) + US-411 (3) + descope option on US-406.

---

## 9. Exit Checklist

- [ ] RFC-003 GA: `ReadinessScore` model + recompute job in production behind flag.
- [ ] Mastery Dashboard shows Readiness Score + domain drill-down + Next Topic suggest for the 200-user beta cohort.
- [ ] Time Pressure Mode shippable on `/exam/setup` (toggle + e2e green).
- [ ] RLS enabled on `org_members` + `org_questions`; cross-org regression suite green; latency budget held.
- [ ] `LlmUsageEvent` ledger writing on every AI gen call; Grafana cost panel live; warn-only quota wired.
- [x] Predictor validation harness + survey banner deployed; baseline r recorded for Sprint 5 retro.
- [ ] Free-user premium gate (blurred gauge + CTA) deployed; no regression on free dashboard a11y.
- [ ] axe-core + visual regression + Lighthouse perf ≥85 / a11y ≥95 green on `/dashboard/mastery` and `/exam`.
- [ ] RFC-009 status table updated; new modules in strict-TS allow-list.
- [ ] Sprint Retro held; Sprint 5 prep doc seeded (Squads kickoff, Behavioral Insights pipeline RFC-008).
