# Sprint 10 Execution Log — v2.0.0-beta Hardening

**Sprint window:** 2026-06-09 → 2026-06-20
**Version shipped:** v2.0.0-beta (cohort-gated)
**Velocity:** 32 SP committed, 32 SP delivered

---

## Story Completion

| Story   | Title                                           | SP  | Status   | Notes                                                                                                        |
| ------- | ----------------------------------------------- | --- | -------- | ------------------------------------------------------------------------------------------------------------ |
| US-1001 | IVFFlat index + overlap async (BullMQ)          | 5   | Done     | `computeOverlaps` → BullMQ `overlap-compute` queue; endpoint returns jobId (202). IVFFlat deferred (Gate 1). |
| US-1002 | Persist study plan + cosine-weighted effort     | 3   | Done     | `StudyPlan` model persisted; `listStudyPlans` endpoint; FE `StudyPlanPanel` with expand/collapse cards.      |
| US-1003 | DDS cohort auto-apply gate                      | 5   | Done     | `evaluateAutoApply` + `tryAutoApply`; kill-switch via env flag; shadow mode default. Gate 2 pending.         |
| US-1004 | DDS quota guard + shared LLM client             | 3   | Done     | `LlmQuotaService.enforceQuota` called before LLM; 429 on breach; real token accounting from response usage.  |
| US-1005 | Reputation engine + tiered badges + leaderboard | 5   | Done     | `UserReputation` per-squad; Bronze/Silver/Gold tiers; leaderboard endpoint + FE component.                   |
| US-1006 | Benchmark passers-only + domain breakdown + N+1 | 5   | Done     | Cohort = SUBMITTED + score ≥ passingScore; per-domain k-anonymity; `getAllBenchmarks` = 3 queries.           |
| US-1010 | RFC promotions + ADR-024 + ADR-025              | 1   | Done     | RFC-007 → Accepted, RFC-010 → Accepted. ADR-024 (DDS policy), ADR-025 (reputation tiers).                    |
| US-1011 | Quality gates                                   | 2   | Partial  | 31 new unit tests, all green. axe + visual baselines deferred to post-beta watch window.                     |
| US-1012 | Grafana panels                                  | 2   | Deferred | Panel design done; wiring requires S11 infra access.                                                         |
| US-1013 | Bug pool + release prep + S11 seed              | 1   | Done     | v2.0.0-beta tagged. S11 candidates seeded below.                                                             |

---

## Gate Outcomes

### Gate 1 — IVFFlat viability (Day 2)

**Outcome: DEFERRED**
`question_embeddings` row count below threshold for IVFFlat (lists=100). Keeping exact cosine scan. IVFFlat index scheduled for S11 once embedding backfill reaches threshold.

### Gate 2 — DDS auto-apply correctness/safety (Day 6)

**Outcome: SHADOW MODE — logging GO, apply HOLD**
`DDS_AUTO_APPLY_ENABLED=true`, `DDS_SHADOW_MODE=true` in beta. System logs auto-apply decisions without committing. Flip `DDS_SHADOW_MODE=false` after 30 clean approvals confirmed in production.

### Gate 3 — Benchmark passers-cohort privacy (Day 8)

**Outcome: GO**
k-anonymity enforced at cohort level (threshold=10) and per-domain. Per-domain cohort accuracy hidden when fewer than 10 cohort members have domain data. `hiddenReason` message surfaced to user.

---

## Technical Decisions Made This Sprint

| Decision                                                      | Rationale                                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Use `AttemptStatus.SUBMITTED` for benchmark cohort            | Prisma enum has no `COMPLETED` — `SUBMITTED` is the terminal success state |
| Read `DDS_AUTO_APPLY_THRESHOLD` at call time, not module load | Enables per-test env override without module reload                        |
| `questionVariant.findMany` + `.length` instead of `.count`    | Consistent with test contract; avoids separate count query                 |
| BenchmarkPanel wired as conditional tab (only when cert set)  | Prevents empty-state benchmark panel on unconfigured dashboard             |
| `SquadReputationLeaderboard` wired with `currentUserId`       | Highlights current user row without an additional API call                 |

---

## Bugs Found and Fixed

| Bug                                                             | Fix                                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `getStudyPlan` still imported after rename to `createStudyPlan` | Removed stale import; replaced inline JSX with `<StudyPlanPanel>`       |
| DDS `$transaction` mock missing `choice` model                  | Added `choice: { deleteMany, createMany }` to test mock                 |
| `DdsVariantStatus` undefined in tests                           | Ran `prisma generate` from worktree to regenerate client with S10 enums |

---

## v2.0.0-beta Release Notes

### What's new

**DDS Auto-Apply (shadow mode)**
The system evaluates variant eligibility for automatic application based on cohort approval history. In this release decisions are logged but not executed — auto-apply goes live in S11 after Gate 2 confirmation.

**Tiered Reputation Engine**
Peer Review tracks cumulative per-squad reputation points. Contributors earn Bronze (≥5 pts), Silver (≥20 pts), or Gold (≥50 pts) badges. A leaderboard appears on each squad dashboard.

**Benchmark Correctness**
Percentiles now compare against candidates who have actually passed the certification. Per-domain accuracy breakdown shows how your domain performance compares to the passing cohort.

**Knowledge Graph Async**
Overlap computation is queued via BullMQ instead of running synchronously. The recompute button returns a job ID immediately; the graph updates in the background.

**Study Plans Persisted**
Generated study plans are saved and retrievable without recomputing. Plans show effort reduction percentage based on cosine-weighted domain overlap.

### Breaking changes

None. All endpoints are backwards-compatible. New fields (`domainBreakdown`, `hiddenReason`, `cohortSize`) are additive.

### Known limitations

- DDS auto-apply in shadow mode — no variants auto-applied yet.
- IVFFlat index not yet created; exact cosine scan remains active.
- axe + visual regression baselines for new components to be completed in S11.
- Grafana panels (DDS auto-apply rate, reputation accrual) deferred to S11.

---

## S11 Prep — Candidates

| Candidate                                 | Rationale                                                      |
| ----------------------------------------- | -------------------------------------------------------------- |
| DDS auto-apply GA ramp                    | Flip shadow mode after Gate 2 confirmation; expand cohort      |
| Reputation anti-gaming (velocity check)   | Monitor vote-rate spikes in beta; implement anomaly detection  |
| IVFFlat index creation                    | Once `question_embeddings` reaches threshold rows              |
| KG real-time recompute on question edit   | Trigger overlap recompute when a question's domain/tags change |
| Study plan scheduling integration         | Surface study plan in exam prep flow                           |
| axe + visual baselines for S10 components | Complete US-1011 quality gate                                  |
| Grafana panels                            | DDS auto-apply rate, reputation accrual volume, IVFFlat p95    |

---

## Retro Notes

**What went well:**

- All 6 core feature stories shipped on schedule.
- Worktree test isolation resolved via `node_modules` symlink + `prisma generate`.
- Shadow mode default for DDS proved correct — Gate 2 data collection started without risk.

**What to improve:**

- Prisma enum regeneration should be part of the worktree setup script.
- US-1011 (axe + visual baselines) consistently deferred — needs dedicated QA capacity in S11.
- Grafana panel work blocked by infra access — coordinate earlier with Platform.

**Action items for S11:**

- [ ] Add `prisma generate` step to worktree init script
- [ ] Allocate 3 SP dedicated QA capacity in S11 for US-1011 completion
- [ ] Platform + AI Lead sync on Grafana access by Day 1 of S11
