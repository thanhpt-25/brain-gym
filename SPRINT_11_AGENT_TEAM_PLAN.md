# Sprint 11 Agent Team Plan — Lanes D & E Close-out

**Objective:** Complete v2.0.0-rc release by 2026-07-04  
**Current Status:** Lanes A–C complete (21 SP); **Lanes D–E remaining (13 SP)**  
**Model:** Haiku 4.5 (lightweight agents, parallel work) + Sonnet 4.6 (complex coordination)

---

## Team Composition

### 1. **QA & Testing Agent** (US-1105)

**Role:** Accessibility, visual regression, test coverage close-out  
**Scope:** 3 SP  
**Tasks:**

- Run axe-core automated scans on 4 S10 components (`DdsAutoApplyPanel`, `SquadReputationLeaderboard`, study-plan saved view, benchmark domain breakdown)
- Capture visual baselines at 4 breakpoints (320/768/1024/1440px)
- Verify zero `describe.skip` in test suite
- Ensure ≥80% coverage for all new S11 code (check `src/ai-question-bank/dds/`, `src/squads/peer-review/`, `src/analytics/benchmark/`, `src/knowledge-graph/`)
- **Acceptance:** axe ≥95 on all 4 components, baselines committed, coverage ≥80%

**Owner:** QA Lead + Senior FE  
**Slack Key:** `US-1105`

---

### 2. **Infrastructure & Observability Agent** (US-1106, US-1109, US-1111)

**Role:** Grafana panels, alert rules, worktree setup  
**Scope:** 6 SP (3 + 2 + 1)  
**Tasks:**

**US-1106** (3 SP):

- Create Grafana panels from design done in S10:
  - DDS auto-apply rate (% variants auto-applied) + rollback rate (%)
  - Reputation accrual volume + anomaly-flag volume (daily)
  - IVFFlat/overlap query p95 (before/after index)
  - LLM cost breakdown by feature (EMBEDDING, DDS, COACH)
- Wire to Prometheus metrics (assume `LlmUsageEvent` + `DdsVariant.reviewNote = "auto-applied"` queryable)
- Verify panels populate with synthetic data or staging data if available

**US-1109** (2 SP):

- Create alert rule: trigger when rollback-rate exceeds threshold (e.g., >5%) in 10-minute window
- Runbook entry in `docs/oncall.md`: "DDS Rollback Rate Alert" describing auto-pause behavior (already implemented in US-1101 L1 code) and investigation steps
- Verify alert arm/disarm via Grafana UI

**US-1111** (1 SP):

- Add `prisma generate` step to worktree init script (retro action — schema enums regen was blocking tests)
- Document in `.claude/launch.json` or `CLAUDE.md`

**Owner:** Platform Lead + Senior DevOps  
**Slack Key:** `US-1106`, `US-1109`, `US-1111`

---

### 3. **Security & Release Agent** (US-1110, US-1113, US-1112 coordination)

**Role:** ADRs, security sweep, release tagging  
**Scope:** 4 SP (1 + 1 + 2)  
**Tasks:**

**US-1110** (1 SP):

- Write **ADR-026: DDS Auto-Apply GA + Canary Policy**
  - Decision: flip `DDS_SHADOW_MODE=false` for cohort after Gate 2 approval
  - Canary: auto-pause rollback-rate threshold (define concrete number, e.g., >5% in 10m window)
  - Rollback window: e.g., last 50 variants
  - Rationale: safe auto-apply ramp vs proposal-only
- Write **ADR-027: Reputation Anti-Gaming Thresholds**
  - Vote-velocity window: e.g., ≤10 votes to same author/explanation per 5-minute window = suspicious
  - Vote-ring heuristic: e.g., ≥3 votes from squad members to each other in < 1 hour (configurable per squad size)
  - False-positive tolerance: < 2% (flagged votes that later clear)
  - Point-hold policy: don't accrue until admin clears flag
- Link ADRs in `docs/adr/` and index in `docs/adr/00-index.md`

**US-1113** (1 SP):

- Security regression sweep: **prompt-injection close-out for SP-7 threat model**
  - DDS rewrite prompt: check for injection in `QuestionVariant.reason` / `diff` if user-supplied (currently not user-input, safe)
  - Coach safety: verify `coach-safety.service.ts` jailbreak patterns + filter response still in effect
  - Test with 5–10 known LLM injection payloads in test suite (`backend/test/training/coach/coach-safety-sp7.spec.ts`)
  - Document: update `docs/security/threat-model.md` with SP-7 closure (LLM prompt injection mitigated by jailbreak detection + response filter)

**US-1112** (2 SP, **coordination across agents**):

- **Execution Log:** keep `docs/team-planning/sprint-11-execution-log.md` daily updated (Team Lead / SM manages this; agents feed input)
- **v2.0.0-rc release:**
  - Tag: `git tag v2.0.0-rc`
  - Release notes: summarize Lanes A–E, note cohort-gating (auto-apply beta, reputation beta, benchmark beta for ≥50 attempts per cert)
  - Seed **S12 GA prep:** full-cohort ramp checklist document (in `/docs/team-planning/sprint-12-prep.md`)
    - [ ] Remove cohort-gate (open auto-apply, reputation, benchmark to all users)
    - [ ] Load test (10k concurrent study sessions, embed latency p95 < 500ms, DDS p95 < 200ms)
    - [ ] Final a11y audit (Lighthouse mobile ≥95)
    - [ ] Perf profile (identify any N+1 queries introduced in v2.0)
    - [ ] Customer comms draft

**Owner:** Tech Lead + Security Engineer  
**Slack Key:** `US-1110`, `US-1113`, `US-1112`

---

## Parallel Execution Plan

### Week 2 (2026-06-30 → 07-04, assuming Lanes A–C finish on schedule by end of Week 1)

| Ngày    | QA (US-1105)                       | Infra (US-1106/09/11)              | Security (US-1110/13/12)        |
| ------- | ---------------------------------- | ---------------------------------- | ------------------------------- |
| **Mon** | axe scan on 4 components (S10)     | Grafana panel skeletons; row check | ADR-026 draft + review S10 docs |
| **Tue** | Visual baselines 320/768/1024/1440 | Grafana data wiring + alert rule   | ADR-027 anti-gaming thresholds  |
| **Wed** | Coverage check ≥80% new code       | Alert runbook + `prisma generate`  | SP-7 prompt-injection sweep     |
| **Thu** | All green; code freeze             | Panels live; Grafana alert armed   | ADRs committed; test cases done |
| **Fri** | Post-release E2E verify (gates)    | Monitor panels 24h                 | Monitor security alerts         |

---

## Communication & Handoffs

1. **Daily Standup** (async in Slack `#sprint-11`, 09:00 UTC):
   - QA: "axe scan 2/4 green; baseline capture Thu"
   - Infra: "panel wiring 70%; alert rule UAT Mon"
   - Security: "ADR-026 consensus with AI Lead; SP-7 test prep done"
   - SM: log in execution-log.md

2. **Gate Meetings** (scheduled, all lanes contribute):
   - **Day 5 (Fri 2026-06-27) 14:00 UTC:** Gate 2 data review (AI Lead presents clean-approval count; Security/Infra flag concerns; QA readiness check)
   - **Day 7 (Tue 2026-07-01) 14:00 UTC:** Gate 3 anti-gaming FP rate (Infra reports metrics; QA + Security green light for go/no-go)

3. **Handoff: Infra → QA (post-code-freeze)**
   - Thu end-of-day: Infra confirms Grafana panels live + alert armed
   - Fri: QA runs E2E test suite against live panels (demo gates 2–3 via UI)

---

## Descope Ladder (Pre-approved, in priority order)

If Day 6 burndown trailing:

1. **US-1108 IVFFlat defer → S12** (−3 SP) — exact scan still adequate if rows < 10k threshold
2. **US-1106 panels ship without custom alerting** (−2 SP) — panels live for visibility; alert rule to S12
3. **US-1105 visual baselines defer subset** (−1 SP) — keep axe only; baselines S12
4. **US-1113 security sweep → "audit + log only"** (−0.5 SP) — run scan, document findings; remediation S12

---

## Success Criteria (Exit Gate)

- [ ] **QA:** axe ≥95 on all 4 S10 components; visual baselines captured & committed; coverage ≥80% S11 code
- [ ] **Infra:** Grafana panels live + data flowing; rollback-rate alert rule armed; worktree `prisma generate` auto-step active
- [ ] **Security:** ADR-026 & ADR-027 committed to `docs/adr/`; SP-7 prompt-injection sweep passed; 5+ injection test cases in suite
- [ ] **Release:** v2.0.0-rc tagged; release notes published; S12 GA prep checklist seeded; execution log complete
- [ ] **Zero blockers:** No `describe.skip`, no build errors, no Grafana query failures, no ADR TODOs

---

## Risk Mitigation

| Risk                                         | Mitigation                                                                   | Owner    |
| -------------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| Grafana access blocked again (S10 repeat)    | Sync Platform access Day 1 (retro crutch); design pre-made from S10          | Infra    |
| axe fails on new component (unexpected a11y) | Start scan Mon; if failures, QA escalates to FE for quick wins by Wed        | QA + FE  |
| Anti-gaming detector FP rate too high        | Gate 3 decision Day 8; if >2%, descope #4 (log-only); tune in S12            | Security |
| ADR consensus stalls on canary threshold     | Tech Lead + AI Lead align threshold by Wed; if no consensus, use data-driven | Security |

---

## Handoff to Sprint 12

**Deliverables from Lanes D–E:**

- v2.0.0-rc (cohort-gated) on main branch
- All integration tests green; E2E gates passing
- Grafana observability stack live
- Security posture: SP-7 (prompt injection) closed
- S12 GA prep document seeded with full-cohort ramp checklist

**Assumptions for S12:**

- Lanes A–C complete without major rework
- Gate 2 auto-apply flip approved (otherwise US-1101 shadow-mode descope applies)
- Gate 1 IVFFlat either live (if rows ≥10k) or deferred with exact-scan fallback
- QA team capacity 3 SP reserved for gates/perf/a11y final audit

---

**Prepared by:** Claude Code  
**Date:** 2026-05-29  
**Status:** Ready for Sprint Kickoff (2026-06-23)
