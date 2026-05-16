# Sprint 5 — "Build the Moat: Squads + Insights" Implementation Plan

- **Version target:** v1.3.0-alpha
- **Capacity:** 48 SP (hold velocity from Sprint 4; revisit at retro)
- **Window:** 2026-05-29 → 2026-06-11 (2 weeks)
- **Status as of 2026-05-14:** Sprint 4 merged to `main` (PR #35). All Sprint 4 exit-checklist items shipped behind `FF_PREDICTOR_BETA`; beta cohort survey live. Phase-2 RLS tests are currently skipped pending controller implementation (commit `9d9a50e`) — this sprint unblocks them.
- **Sprint goal:** Read out Predictor validation (n≥200, r), expand RLS to remaining org-scoped tables, ship **Behavioral Insights v0** pipeline (RFC-008), kick off **Training Squads** (RFC-005/011) with create flow + minimal dashboard, flip **LLM quota from warn-only to blocking** (RFC-012), and land a **Reviewer Queue MVP** so flagged questions stop piling up.

Source artefacts:

- [00-master-roadmap.md §Sprint 5–8 "Build the Moat" / §4 Decisions D2, D3, D5](./00-master-roadmap.md)
- [01-product-owner.md §3 NEXT — US-009, US-010, US-014, US-016](./01-product-owner.md)
- [03-tech-lead.md RFC-005, RFC-006, RFC-008, RFC-010, RFC-011, RFC-012](./03-tech-lead.md)
- [04-ux-qa-lead.md §SquadRankRow, ActivityFeedItem, CoachChat](./04-ux-qa-lead.md)
- [sprint-04-implementation-plan.md §9 Exit Checklist](./sprint-04-implementation-plan.md)
- [DEPLOYMENT_CHECKLIST_SPRINT04.md](../../DEPLOYMENT_CHECKLIST_SPRINT04.md)

---

## 1. Sprint Goal & Demo

**Goal Hit Criteria:**

- **Predictor read-out**: Pearson **r** computed on ≥200 beta responses; go/no-go decision documented in `docs/team-planning/sprint-05-retro.md`. No production widen this sprint unless r ≥ 0.5.
- **RLS phase-2 GA**: enabled on `org_groups`, `org_invites`, `assessments` (+ controllers wired). Cross-org regression suite in `backend/test/security/rls.cross-org.e2e-spec.ts` un-skipped and green. Latency budget held (p95 < 400ms).
- **Behavioral Insights v0**: RFC-008 GA; nightly job consumes `attempt_events` → writes `BehavioralInsight { userId, certId, kind, payload }`; first three insight kinds shipped: `slow_on_long_stems`, `accuracy_decline_after_30min`, `domain_streak_break`.
- **Training Squads kickoff**: Squad = `Organization` subtype per Decision D5; `POST /api/v1/squads`, member invite flow, and read-only Squad Dashboard skeleton (member list + readiness%) ship behind `FF_SQUADS_BETA`.
- **LLM quota blocking**: RFC-012 v1 — daily $/org cap enforced; over-quota AI gen returns 429 with grace path; Grafana alert wired.
- **Reviewer Queue MVP**: flagged-question moderation list with filter (flagged / new / ambiguous), accept/reject + audit trail. Closes US-007 outstanding flags from Sprint 4.

**Demo script (Thu, end of S5):**

1. Open `docs/team-planning/sprint-05-retro.md` → show r-correlation chart + go/no-go.
2. Mai logs in → creates a Squad (cert: AWS SAA-C03, 6 members) → invite link generated → second user joins → Squad Dashboard lists members with readiness%.
3. Linh's dashboard → new "Behavioral Insight of the week" banner: _"You're 18% less accurate after 30 minutes — try shorter sessions."_
4. Admin hits AI-gen 21× in a day → 429 with quota message; Grafana panel shows org over-quota.
5. Hùng opens `/admin/review-queue` → filters `flagged`, accepts one, rejects one with reason → audit trail visible.
6. Cross-org RLS regression suite run live; all 30 cases green; show denial counter in Grafana.

---

## 2. Story Breakdown (48 SP)

| ID     | Title                                                               | SP  | Owner             | Lane       | Depends                   |
| ------ | ------------------------------------------------------------------- | --- | ----------------- | ---------- | ------------------------- |
| US-501 | Predictor validation read-out + go/no-go doc                        | 3   | PO + BE           | Spike      | S4 US-408                 |
| US-502 | RFC-006 phase-2 — RLS on `org_groups`, `org_invites`, `assessments` | 8   | Security Champion | Foundation | S4 US-406                 |
| US-503 | RFC-008 GA — `BehavioralInsight` pipeline + 3 insight kinds         | 8   | Senior BE         | Foundation | S3 AttemptEvent           |
| US-504 | Behavioral Insight banner on Mastery Dashboard                      | 3   | FE + UX           | Feature FE | US-503                    |
| US-505 | Squads — schema + create/invite API (US-009)                        | 8   | BE                | Feature BE | Decision D5 (RFC-011)     |
| US-506 | Squad Dashboard skeleton (US-010 partial: member + readiness)       | 5   | Senior FE + UX    | Feature FE | US-505, S4 ReadinessScore |
| US-507 | RFC-012 v1 — daily $/org quota **blocking** + 429 path              | 3   | Platform          | Foundation | S4 US-407                 |
| US-508 | Reviewer Queue MVP (US-016)                                         | 5   | FE + BE           | Feature    | S4 flag column            |
| US-509 | RFC-009 strict TS rollout — `insights/` (FE) + `squads/`            | 3   | Senior FE         | Tech debt  | S4 US-409                 |
| US-510 | Bug pool + Sprint-4 post-release watch                              | 1   | Whole team        | Buffer     | —                         |
| US-511 | Retro action items + Sprint-6 prep                                  | 1   | SM                | Process    | —                         |

Total: **48 SP**. Descope order if Day 6 burndown trails: drop US-509 → US-508 → narrow US-502 to 2 tables.

---

## 3. Day-by-Day Plan

### Week 1 (2026-05-29 → 06-04)

| Day | Focus                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------- |
| Fri | Planning 90'. RFC-008 final review. RFC-011 (Squad-as-Org subtype) ADR merged. Predictor survey n-check.       |
| Mon | BE: US-503 `BehavioralInsight` migration + nightly job skeleton. BE: US-505 Squad schema + `POST /squads`.     |
| Tue | US-502 RLS migration drafted on `org_groups`; controllers wired; existing skipped tests un-skipped one-by-one. |
| Wed | US-507 quota enforcement middleware; 429 response shape; Grafana alert. US-501 r-correlation notebook re-run.  |
| Thu | FE: US-504 insight banner + Storybook. FE: US-506 Squad Dashboard skeleton wired to API.                       |
| Fri | Refinement. US-508 Reviewer Queue list + filter UI. axe gate run on `/admin/review-queue`.                     |

### Week 2 (2026-06-05 → 06-11)

| Day | Focus                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------- |
| Mon | US-502 phase-2 RLS regression suite green; k6 re-run; latency budget guard. US-505 invite-link flow.            |
| Tue | US-503 three insight kinds landed + unit-tested. US-508 accept/reject + audit trail.                            |
| Wed | US-509 strict-TS rollout merged. US-501 go/no-go doc written. End-to-end demo dry run.                          |
| Thu | Code freeze. axe + visual + e2e gates green. v1.3.0-alpha release behind `FF_SQUADS_BETA` + `FF_INSIGHTS_BETA`. |
| Fri | Sprint Review + Retro. Sprint 6 prep (Scenario engine RFC, AI Coach 1-1 RFC-010 hardening).                     |

---

## 4. Story Implementation Notes

### US-501 — Predictor validation read-out (3 SP, PO + BE)

- Notebook `backend/scripts/predictor-validation.md` re-run against current `pass_likelihood_surveys` (n ≥ 200 expected by Day 1).
- Output: `docs/team-planning/sprint-05-retro.md` with r value, scatter plot path, and one of three decisions: **(a) widen rollout** (r ≥ 0.5), **(b) iterate heuristic** (0.3 ≤ r < 0.5), **(c) hold + re-survey** (r < 0.3).
- No code shipped this sprint based on outcome — Sprint 6 backlog absorbs the follow-up.

### US-502 — RLS phase-2 (8 SP, Security Champion + BE)

- Enable RLS on `org_groups`, `org_invites`, `assessments`. Policy mirror of phase-1: `current_setting('app.org_id')::uuid = org_id`.
- **Un-skip** the Phase-2 cases in `backend/test/security/rls.cross-org.e2e-spec.ts` (skipped at commit `9d9a50e`); implement missing controllers as part of this story.
- k6 re-run: p95 must stay within ±10% of phase-1 baseline.
- Rollback: one migration per table; can disable individually.
- Updates `docs/security/rls-rollout.md` phase-2 status table.

### US-503 — `BehavioralInsight` pipeline (8 SP, Senior BE)

- Per RFC-008 in [03-tech-lead.md](./03-tech-lead.md): nightly BullMQ job `insights:behavioral:nightly` reads `attempt_events` for the last 14 days, computes patterns, writes one row per (userId, certId, kind).
- Three insight kinds for v0:
  - `slow_on_long_stems` — response-time delta on stems > 200 words vs ≤ 200.
  - `accuracy_decline_after_30min` — bucketed accuracy in 0–30 / 30–60 / 60+ min sessions.
  - `domain_streak_break` — last seen → next seen gap > 7 days on a previously-strong domain.
- Pure functions in `backend/src/insights/behavioral/patterns.ts` — 100% branch coverage.
- Idempotent: re-running the job upserts on `(userId, certId, kind, generatedFor)`.
- Feature-flagged `FF_INSIGHTS_BETA`; respects existing `User.featureFlags` shape.

Files:

- `backend/prisma/schema.prisma` (+`BehavioralInsight`)
- `backend/src/insights/behavioral/patterns.ts`
- `backend/src/insights/behavioral/behavioral.processor.ts`
- `backend/src/insights/behavioral/behavioral.service.ts`
- `backend/test/insights/behavioral.e2e-spec.ts`

### US-504 — Insight banner on Mastery Dashboard (3 SP, FE + UX)

- `<BehavioralInsightBanner />` above `<ReadinessGauge />` when one fresh insight exists for the active cert.
- Copy templates per insight kind; tone matches editorial direction.
- Dismiss action persists for 24h via `User.featureFlags.dismissedInsightIds`.
- Visual regression baseline: 320 / 768 / 1440 × light + dark.
- a11y: `role="status"`, `aria-live="polite"`.

### US-505 — Squads schema + create/invite API (8 SP, BE)

- Per Decision D5 (RFC-011): `Squad` is an `Organization` row with `kind = 'SQUAD'`. No new top-level model — extend existing `Organization` + `OrgMember`.
- Endpoints:
  - `POST /api/v1/squads` `{ name, certificationId, targetExamDate }` → creates org + adds creator as `OWNER`.
  - `POST /api/v1/squads/:id/invites` → returns short-lived signed link.
  - `POST /api/v1/squads/join/:token` → adds caller as `MEMBER`.
- Constraint: Squads cannot own `Catalog` or `Assessment` (enforced in service layer); regression test included.
- RLS phase-2 applies automatically since `org_id` policy is generic.

### US-506 — Squad Dashboard skeleton (5 SP, Senior FE + UX)

- Route: `/squads/:slug` (top-level; not nested under `/org/:slug` because squads are user-led, not company-led).
- Read-only this sprint: member list with avatar, readiness%, last-active timestamp.
- Empty state: "Invite members to see their readiness."
- Inactive (>7 days) member rows tagged with subtle warning chip — no nudge action yet (Sprint 6).
- Visual regression baseline added. axe-core green.

### US-507 — LLM quota blocking (3 SP, Platform)

- Move RFC-012 from warn-only (Sprint 4) to blocking. Daily $/org cap configurable via `OrgSettings.llmDailyUsdCap`.
- Over-quota path: `POST /api/v1/ai/generate` returns `429 { code: 'LLM_QUOTA_EXCEEDED', resetAt }`; FE handles via existing toast pattern.
- Grace: org `OWNER` sees an over-quota banner with link to billing settings (stubbed link — billing-portal work is Sprint 7).
- Grafana alert: org > 80% quota by 18:00 UTC.

### US-508 — Reviewer Queue MVP (5 SP, FE + BE)

- Per US-016: `/admin/review-queue` list with filter chips `flagged | new | ambiguous`.
- Row actions: **Accept** (move question to `PUBLISHED`), **Reject** (requires reason, ≥10 chars).
- Audit trail: every action writes `ModerationAudit { questionId, reviewerId, action, reason, at }`.
- Closes the flag backlog created by US-007 in Sprint 4.

### US-509 — Strict TS rollout (3 SP, Senior FE)

- Add FE `insights/` and new `squads/` modules + BE `insights/behavioral/` to the strict-TS allow-list.
- Cap diff at 200 LOC; if larger, file ticket and stop. Updates RFC-009 status table.

### US-510 — Bug pool + post-release watch (1 SP)

- On-call eng watches Sprint 4 v1.2.0 metrics for the first 5 days of Sprint 5 (recompute SLA, RLS denial logs, quota warnings).

### US-511 — Retro + Sprint 6 prep (1 SP, SM)

- Retro doc seeded: `docs/team-planning/sprint-06-prep.md`.
- Sprint 6 candidates: AI Coach 1-1 beta (RFC-010), Scenario reader spike (E4), Squad daily-challenge (US-011), Burnout detection (US-015).

---

## 5. Cross-cutting Engineering Tasks

| Task                                               | Owner     | Notes                                                                    |
| -------------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| Feature flag: `FF_SQUADS_BETA`, `FF_INSIGHTS_BETA` | Platform  | Per-user gate via existing `User.featureFlags` JSON column               |
| Privacy doc updated for `BehavioralInsight`        | Tech Lead | One-pager in `docs/security/privacy-events.md`; data retention = 90 days |
| Squad-aware nav entry behind flag                  | FE        | Top-bar item "Squads" visible only when `FF_SQUADS_BETA = true`          |
| Grafana panel: LLM quota over-cap rate             | Platform  | Required guardrail before opening AI gen to free tier                    |
| `docs/team-planning/sprint-05-retro.md` template   | SM        | Created Day 1; PO writes go/no-go section Day 8                          |

---

## 6. Definition of Ready / Done

**DoR (per story):**

- AC written and reviewed by PO; RFC/ADR linked for any schema change.
- Test plan named (unit / integration / e2e / visual / perf).
- Owner + reviewer assigned. Feature-flag plan stated where user-visible.

**DoD (per story):**

- Code merged to `main` via PR with green CI (lint + typecheck + unit + e2e + axe + visual + Lighthouse).
- ≥80% coverage on new code; total coverage not down >1%.
- Docs updated where touched (RLS rollout doc, RFC-008/011 status, RFC-009 status table).
- Demo-able on staging behind correct feature flag.
- No CRITICAL/HIGH from `code-reviewer` or `security-reviewer` agent open.
- Beta-impacting stories: rollback plan written.

---

## 7. Risks & Mitigations (Sprint 5 specific)

| Risk                                                                           | P×I | Mitigation                                                                                                     | Owner             |
| ------------------------------------------------------------------------------ | --- | -------------------------------------------------------------------------------------------------------------- | ----------------- |
| Predictor r < 0.3 → forces rework, blocks Squad readiness UI value-prop        | M×H | Decoupled this sprint: Squad Dashboard renders raw readiness regardless; rework lives in Sprint 6 backlog      | PO + BE           |
| RLS phase-2 breaks controllers that were stub-only at end of Sprint 4          | H×M | Un-skip tests incrementally per table; descope to 2 tables if Day 6 trails                                     | Security Champion |
| Behavioral Insight false-positives hurt trust ("you're slow" when user wasn't) | M×M | Confidence threshold per insight kind; only show insights with n ≥ 20 events of evidence                       | Senior BE         |
| Squad invite link abused (spam / public re-share)                              | M×M | Signed token with 7-day TTL + single-use; rate-limit `POST /squads/:id/invites` to 10/day per OWNER            | Security Champion |
| 429 quota response confuses paid users mid-flow                                | L×H | UX copy reviewed with PO before Code Freeze; banner explains, links to settings; over-quota only blocks AI gen | UX/QA             |
| Reviewer Queue accept races with concurrent edits                              | L×M | Optimistic concurrency: include `updatedAt` in accept payload; 409 on mismatch                                 | BE                |
| Sprint capacity strain from Squad scope (3 stories)                            | M×M | US-506 explicitly skeleton-only (read-only member list); leaderboard + daily challenge deferred to Sprint 6    | SM                |

---

## 8. Capacity & Allocation

| Role              | Capacity (SP) | Allocated                                         |
| ----------------- | ------------- | ------------------------------------------------- |
| Senior BE         | 11            | US-503 (8), US-510 (1), buffer (2)                |
| BE                | 9             | US-505 (8), US-508 BE half (1)                    |
| Senior FE         | 11            | US-506 (5), US-509 (3), US-504 (3)                |
| FE                | 9             | US-508 FE half (4), US-504 polish (2), buffer (3) |
| UX/QA             | 5             | US-504/506 design (3), axe + visual (2)           |
| Security Champion | 8             | US-502 (8 — pairs with Senior BE for migrations)  |
| Platform          | 3             | US-507 (3)                                        |
| PO + SM           | —             | US-501 (3), US-511 (1), facilitation, beta comms  |
| **Total**         | **48**        |                                                   |

20% buffer is implicit in US-510 + descope ladder on US-509 → US-508 → US-502 (drop to 2 tables).

---

## 9. Exit Checklist

- [ ] Predictor go/no-go doc merged at `docs/team-planning/sprint-05-retro.md` with r value and decision.
- [ ] RLS enabled on `org_groups`, `org_invites`, `assessments`; phase-2 regression suite un-skipped and green; latency budget held.
- [ ] `BehavioralInsight` model + nightly job in production behind `FF_INSIGHTS_BETA`; three insight kinds writing.
- [ ] Mastery Dashboard renders insight banner for beta users; a11y + visual baselines green.
- [ ] `POST /squads` + invite + join endpoints live; Squad Dashboard skeleton renders member readiness; `FF_SQUADS_BETA` gated.
- [ ] LLM quota blocking enforced; 429 path tested; Grafana over-cap alert wired.
- [ ] Reviewer Queue MVP shipped; flag backlog from Sprint 4 cleared or assigned.
- [ ] RFC-009 status table updated; new modules in strict-TS allow-list.
- [ ] axe-core + visual regression + Lighthouse perf ≥85 / a11y ≥95 green on `/dashboard/mastery`, `/squads/:slug`, `/admin/review-queue`.
- [ ] Sprint Retro held; Sprint 6 prep doc seeded (AI Coach beta, Scenario reader spike, Squad daily-challenge).
