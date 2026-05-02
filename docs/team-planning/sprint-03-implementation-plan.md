# Sprint 3 — "Insight Kickoff" Implementation Plan

- **Version target:** v1.2.0-alpha
- **Capacity:** 44 SP
- **Window:** 2026-05-01 → 2026-05-14 (2 weeks)
- **Sprint goal:** Stand up the AttemptEvent pipeline end-to-end, ship Mastery Dashboard v1, harden streak + a11y, derisk bus-factor on exam engine, and produce a Pass Predictor v0 spec.

Source artefacts:

- [00-master-roadmap.md §Sprint 3](./00-master-roadmap.md)
- [02-scrum-master.md §5.3 Sprint 3](./02-scrum-master.md)
- [03-tech-lead.md RFC-001 / SP-1 / SP-4](./03-tech-lead.md)
- [04-ux-qa-lead.md §Editorial + Dark luxury, axe gate](./04-ux-qa-lead.md)

---

## 1. Sprint Goal & Demo

**Goal Hit Criteria** (from roadmap §Sprint 3):

- ≥10k events/day ingest stable on staging.
- RFC-001 (AttemptEvent) approved + merged.
- Mastery dashboard rendered with real production-shape data.
- Editorial + Dark luxury direction confirmed and tokens committed.
- axe-core CI gate green on 8 main routes (0 critical/serious).
- Pass Predictor v0 spec presented (RFC-003 draft).

**Demo script (Tue, end of S3):**

1. Take an exam → show AttemptEvent rows in DB + queue dashboard.
2. Open Mastery Dashboard → real per-domain progress bars feeding from event store.
3. Walk timezone edge case for streak (DST + UTC midnight).
4. Pair-tour walkthrough of `ExamPage.tsx` + `docs/exam-engine.md`.
5. Show axe CI gate run + Pass Predictor RFC-003 draft.

---

## 2. Story Breakdown (44 SP)

| ID     | Title                                      | SP  | Owner          | Lane       | Depends                |
| ------ | ------------------------------------------ | --- | -------------- | ---------- | ---------------------- |
| US-301 | AttemptEvent schema + Prisma migration     | 5   | Senior BE      | Foundation | RFC-001                |
| US-302 | Privacy-aware ingestion endpoint + worker  | 5   | BE             | Foundation | US-301, BullMQ (S2)    |
| US-303 | Mastery dashboard v1 (per-domain progress) | 8   | Senior FE + UX | Feature FE | US-302, tokens (US-T1) |
| US-304 | Streak polish + timezone edge cases        | 5   | FE + BE        | Feature FE | —                      |
| US-305 | Exam engine doc + pair tour                | 3   | Senior FE+Mid  | Knowledge  | —                      |
| US-306 | A11y top-10 fix + axe-core CI gate         | 5   | FE + UX/QA     | A11y       | tokens (US-T1)         |
| US-307 | Spike: Pass Predictor v0 spec (SP-4)       | 5   | BE + PO        | Spike      | US-302 partial         |
| US-308 | Bug pool + support                         | 4   | Whole team     | Buffer     | —                      |
| US-309 | Retro action items execution               | 4   | SM             | Process    | —                      |

Total: **44 SP** (matches capacity; US-308/309 absorb spillover).
US-T1 (oklch tokens commit) is bundled inside US-303 / US-306; not separately pointed.

---

## 3. Day-by-Day Plan

### Week 1 (2026-05-01 → 05-07)

| Day | Focus                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------- |
| Wed | Planning 90'. PO ratifies D1–D6. RFC-001 final review. Spike SP-1 kickoff.                                              |
| Thu | BE: US-301 migration draft + privacy review. FE: tokens.css scaffold (oklch). UX: editorial direction sign-off with PO. |
| Fri | RFC-001 merged. US-302 endpoint scaffold. axe-core wired into Playwright. Tech Sync 30' + Friday demo.                  |
| Mon | Async standup. US-302 ingestion worker + rate limit. US-303 Bento layout draft. US-305 doc outline.                     |
| Tue | Deep work: US-303 DomainBentoCard + query hookup. US-304 timezone fixture tests. US-306 fixes batch 1.                  |
| Wed | Refinement. US-307 heuristic notebook started (BE + PO pair). US-301/302 e2e green on staging.                          |
| Thu | Design review: US-303 visual diff vs. Figma. US-305 pair tour scheduled. axe gate: blocker bugs triaged.                |

### Week 2 (2026-05-08 → 05-14)

| Day | Focus                                                                                               |
| --- | --------------------------------------------------------------------------------------------------- |
| Fri | k6 ingest load (target 10k events/day shape ≈ 0.12 RPS p95). US-306 fixes batch 2.                  |
| Mon | US-303 polish + dark luxury variant. US-307 RFC-003 draft circulated. US-309 retro actions tracked. |
| Tue | Code freeze. axe + visual regression gates green. Demo dry run.                                     |
| Wed | Release v1.2.0-alpha to staging. Stakeholder demo recording.                                        |
| Thu | Sprint Review + Retro. PO writes release note. Roll Sprint 4 prep.                                  |

---

## 4. Story Implementation Notes

### US-301 — AttemptEvent schema (5 SP, BE)

Acceptance:

- Prisma model per [03-tech-lead.md L143–157](./03-tech-lead.md): `AttemptEvent { id, attemptId, userId, questionId?, eventType, payload, clientTs, serverTs }` with both indexes.
- Migration reversible. Seed script generates 1k synthetic events for FE dev.
- Event type union lives in `backend/src/events/event-type.ts` (string union, not Prisma enum, for forward compat). Initial values: `QUESTION_VIEWED`, `CHOICE_SELECTED`, `MARKED`, `FOCUS_LOST`, `SUBMITTED`.
- Unit tests on row-level invariants (clientTs ≤ serverTs + 5min skew, payload schema per type via Zod).

Files:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/<ts>_attempt_events/`
- `backend/src/events/event-type.ts`
- `backend/src/events/event-payload.schema.ts`

### US-302 — Ingestion endpoint + worker (5 SP, BE)

Acceptance:

- `POST /api/v1/events/attempt` accepts batch (max 50 events/req), JWT-guarded, org-scoped.
- Per-user rate limit (60 req/min) via existing throttler.
- Payload validated with Zod; PII fields stripped (no free text in payload v1).
- Hand-off to BullMQ `attempt-events` queue → worker writes to `attempt_events`.
- 99th percentile end-to-end latency <400ms on staging.
- Privacy review checklist signed by Tech Lead + PO (anonymized fields documented).

Files:

- `backend/src/events/events.controller.ts`
- `backend/src/events/events.service.ts`
- `backend/src/events/attempt-events.processor.ts`
- `backend/test/events.e2e-spec.ts`

Frontend hook:

- `src/services/events.ts` — `trackAttemptEvent(event)` with in-memory buffer + 2s flush. Drops events on 401 (refresh handled by api.ts interceptor).

### US-303 — Mastery dashboard v1 (8 SP, FE + UX)

Acceptance:

- New route `/dashboard/mastery` (lazy loaded, wrapped by `<PageTransition>` + `<ProtectedRoute>`).
- Bento layout per [04-ux-qa-lead.md §Editorial + Bento](./04-ux-qa-lead.md): hero "Pass probability placeholder" tile + per-domain progress bars + due review CTA + streak.
- Data via TanStack Query: `useQuery(['mastery', certId], () => getMastery(certId))`.
- Dark mode = luxury palette (oklch tokens), light = editorial cream. Both intentional, not invert.
- Reduced-motion respected; reveal animation only on `transform`/`opacity`.
- Empty state for users with <10 attempts.
- Visual regression baseline added (320, 768, 1440 × light + dark).

Files:

- `src/pages/Dashboard/MasteryPage.tsx`
- `src/components/mastery/DomainBentoCard.tsx`
- `src/components/mastery/MasteryHero.tsx`
- `src/services/mastery.ts`
- `src/styles/tokens.css` (oklch palette commit — closes UX action item)

Backend:

- `GET /api/v1/mastery/:certificationId` aggregates from `attempt_events` + existing `Answer`. Cached 60s in Redis per (user, cert).

### US-304 — Streak edge cases (5 SP, FE + BE)

Acceptance:

- Streak roll-over uses user TZ (stored in `User.timezone`, default `UTC`).
- DST transition test (America/Los_Angeles spring forward) — pure function in `backend/src/streaks/streak.ts`.
- Late-night-in-TZ activity (>23:55 local, server UTC next day) does not break streak.
- Frontend `useStreak()` reads pre-computed value; no client-side date math.
- 95% branch coverage on `streak.ts`.

### US-305 — Exam engine doc + pair tour (3 SP, Senior FE + Mid FE)

Acceptance:

- `docs/exam-engine.md` covers: state machine, timer modes (strict/lenient), mark-for-review, domain breakdown, autosave hooks, known footguns.
- Live 60-min pair tour recorded.
- Mid-FE makes one non-trivial change (e.g. add a marked-for-review filter) under pair supervision and merges it.
- Closes risk **R5 — bus factor exam engine = 1**.

### US-306 — A11y top-10 + axe gate (5 SP, FE + UX)

Acceptance:

- Top 10 issues from `04-ux-qa-lead.md §A11y` fixed (chart text alternatives, focus rings, semantic landmarks, skip-to-main, color contrast in dark mode, etc.).
- `@axe-core/playwright` integrated; CI fails on any critical/serious violation across 8 main routes (`/`, `/auth`, `/dashboard/mastery`, `/exam`, `/srs/today`, `/flashcards`, `/org/:slug`, `/admin`).
- Lighthouse a11y ≥95 on all 8 routes (existing guardrail).
- Doc: `docs/a11y-baseline.md` lists routes + score + run command.

### US-307 — Pass Predictor v0 spec (5 SP, BE + PO)

Spike (SP-4) deliverable, **not production code**:

- Notebook (`backend/scripts/predictor-spike.md` with executable snippets) using weighted heuristic over: SRS coverage, 14-day accuracy, domain spread, time pressure.
- RFC-003 draft committed at `docs/adr/003-pass-predictor-v0.md` covering: input contract from `attempt_events`, output contract (`ReadinessScore` model), confidence calc, fairness checks, success metric (r ≥ 0.75 vs actual pass on 200 user beta).
- Decision D1 (free vs premium-only) reflected — premium-only per PO recommendation.
- No premature productionization; landed only spec + notebook + sample fixtures.

### US-308 — Bug pool + support (4 SP)

Reserve. Triage daily; pull from in-flight bug pool. Cap escaped defects ≤2/sprint per guardrail.

### US-309 — Retro action items (4 SP, SM)

From Sprint 2 retro:

- Linear board fully populated (still open).
- Ceremonies scheduled in calendar.
- `#certgym-daily` + 4 channels created.
- TS strict migration RFC-009 draft (Tech Lead in-progress) reviewed.

---

## 5. Cross-cutting Engineering Tasks

| Task                                                           | Owner     | Notes                                                    |
| -------------------------------------------------------------- | --------- | -------------------------------------------------------- |
| `src/styles/tokens.css` — oklch palette (light + dark)         | UX + FE   | Lands inside US-303; required by US-306 contrast checks  |
| RFC-001 final + ADR commit at `docs/adr/003-attempt-events.md` | Tech Lead | Pre-req for US-301                                       |
| Privacy review doc                                             | Tech Lead | One-pager checked into `docs/security/privacy-events.md` |
| Telemetry contract: client event shape                         | FE + BE   | Shared Zod schema in `src/services/events.schema.ts`     |
| RFC-009 (TS strict) rollout to `services/` modules touched     | Senior FE | Opportunistic; do not expand scope                       |

---

## 6. Definition of Ready / Done

**DoR (per story):**

- AC written and reviewed by PO.
- Schema/contract changes have an RFC or ADR link.
- Test plan named (unit / integration / e2e / visual).
- Owner + reviewer assigned.

**DoD (per story):**

- Code merged to `main` via PR with green CI (lint + typecheck + unit + e2e + axe + visual).
- ≥80% coverage on new code; total coverage not down >1%.
- Docs updated where touched.
- Demo-able on staging.
- No CRITICAL/HIGH from `code-reviewer` agent open.

---

## 7. Risks & Mitigations (Sprint 3 specific)

| Risk                                                                     | P×I | Mitigation                                                                  | Owner     |
| ------------------------------------------------------------------------ | --- | --------------------------------------------------------------------------- | --------- |
| AttemptEvent payload schema churns mid-sprint, breaking FE buffer        | M×H | Freeze v1 schema by Day 2; additive-only changes after that                 | Tech Lead |
| Mastery dashboard depends on real events that don't exist yet in staging | M×M | Seed script (US-301) lands Day 2; FE uses MSW mock until then               | Senior FE |
| axe gate retroactively fails existing routes → blocks merges             | M×M | Stage gate: warn-only Days 1–5, block from Day 6                            | UX/QA     |
| PO D1–D6 not closed by planning                                          | L×H | SM escalates; planning blocked until D1 + D6 decided                        | SM        |
| Predictor spike scope-creeps into implementation                         | M×M | Hard cap: notebook + RFC only, no Prisma changes for `readiness_scores` yet | PO        |
| Pair tour not enough to actually transfer exam-engine knowledge          | M×H | Mid-FE owns one real change pre-merge; SM verifies in retro                 | SM        |

---

## 8. Capacity & Allocation

| Role      | Capacity (SP) | Allocated                                  |
| --------- | ------------- | ------------------------------------------ |
| Senior BE | 10            | US-301 (5), US-302 (5)                     |
| BE        | 9             | US-302 support (2), US-307 (5), US-308 (2) |
| Senior FE | 11            | US-303 (8), US-305 (3)                     |
| FE        | 9             | US-304 (3), US-306 (5), US-308 (1)         |
| UX/QA     | 5             | US-303 design (2), US-306 (3)              |
| Mid FE    | absorbed      | US-305 pair (3 absorbed)                   |
| SM        | —             | US-309 (4), facilitation                   |
| **Total** | **44**        |                                            |

20% buffer is implicit in US-308 + US-309.

---

## 9. Exit Checklist

- [ ] RFC-001 merged + ADR committed.
- [ ] AttemptEvent schema deployed; ingestion stable ≥10k events/day on staging.
- [ ] Mastery dashboard live behind feature flag for premium cohort.
- [ ] tokens.css (oklch) committed; both themes intentional.
- [ ] axe-core CI gate enforced; 0 critical/serious.
- [ ] Streak edge-case tests green; DST regression added.
- [ ] `docs/exam-engine.md` + pair tour recording linked from doc index.
- [ ] RFC-003 (Pass Predictor v0) draft in `docs/adr/`.
- [ ] Retro held; action items filed for Sprint 4.
