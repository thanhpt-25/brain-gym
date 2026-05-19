# Sprint 7 — "Scenarios Live + Coach to GA" Implementation Plan

- **Version target:** v1.4.0 (GA — promote v1.4.0-beta)
- **Capacity:** 48 SP (velocity hold từ Sprint 5–6: 91.7%)
- **Window:** 2026-06-29 → 2026-07-10 (2 tuần)
- **Status as of 2026-06-29:** Sprint 6 đóng (v1.4.0-beta tagged 2026-06-26). 26 SP shipped prod, 18 SP staged. Gate 1 AI Coach **GO** (D7 retention 58%); US-603 RFC-010 hardening đã staged 10% PREMIUM. E4 Scenario Engine spike hoàn thành — **RFC-011 drafted**. E4 full feature đã được descope từ S6 sang sprint này.
- **Sprint goal:** Hoàn thành **toàn bộ unfinished active work**: ship Scenario Simulation Engine (US-012, US-013) lên beta, và đưa AI Coach từ 10%-staged lên **PREMIUM GA** (US-019 productionization + US-014 weekly insight digest).

Source artefacts:

- [sprint-06-execution-log.md](./sprint-06-execution-log.md) — Sprint 6 final stats, gate decisions
- [sprint-06-implementation-plan.md §5 US-611](./sprint-06-implementation-plan.md) — Sprint 7 candidates seeded
- [01-product-owner.md §3](./01-product-owner.md) — US-012, US-013, US-014, US-019 backlog
- `docs/adr/RFC-011-scenario-engine.md` — E4 spike output (quality + cost model)
- `docs/adr/ADR-018-ai-coach-beta-go-nogo.md` — Gate 1 GO decision

---

## 1. Sprint Goal & Demo

**Goal Hit Criteria:**

- **Scenario Engine beta:** User mở Scenario Simulation → render multi-paragraph passage + diagram, chọn answer, nhận explanation theo từng option. Behind `FF_SCENARIO_ENGINE`.
- **Scenario reasoning trace:** Option đã chọn rồi đổi được lưu vào history; "thinking time" analytics hiển thị.
- **AI Coach GA:** `FF_AI_COACH_HARDENED` ramp 10% → 100% PREMIUM. Free user thấy locked state + upgrade CTA.
- **Weekly Insight Digest:** Weekly job sinh "insight tuần" per PREMIUM user; gửi qua email + in-app banner.
- **Cost & safety guardrails:** Coach prompt-injection guard active; Grafana panel cost/session < $0.10; scenario cost/scenario documented và trong budget.
- **Quality gates:** axe-core ≥95, visual regression baseline cho Scenario reader + Coach digest, coverage ≥80% trên module mới.

**Demo script (Thu, end of S7):**

1. **Scenario flow:** Khoa mở `/scenarios/:id` → render passage 300 từ + diagram; submit answer → explanation per-option (correct / distractor / marketing trap). History lưu reasoning trace.
2. **Scenario timer:** Scenario có time limit → hết giờ auto-submit + "thinking time" breakdown.
3. **AI Coach GA:** PREMIUM user (non-beta) mở Coach → session hoạt động, persist qua reload, 429 graceful sau 10 sessions/ngày.
4. **Weekly digest:** Demo account nhận email "Tuần này: bạn yếu IAM khi đọc > 60 phút" + banner in-app; click → drill-down dashboard.
5. **Guardrails:** Thử prompt injection vào Coach → bị guard chặn, log sự kiện. Grafana: cost/session panel.

---

## 2. Story Breakdown (48 SP)

### 2a. Lane A — Scenario Simulation Engine (21 SP)

| ID      | Title                                                          | SP  | Owner          | Depends            |
| ------- | -------------------------------------------------------------- | --- | -------------- | ------------------ |
| US-012a | Scenario schema + AI generation pipeline (BullMQ)              | 5   | Senior BE      | RFC-011            |
| US-012b | Scenario reader UI — multi-paragraph + diagram render          | 6   | Senior FE + FE | US-012a            |
| US-012c | Scenario exam-mode — timer, auto-submit, reasoning trace store | 5   | FE + BE        | US-012b, exam eng. |
| US-013  | Per-option explanation logic + elimination view                | 5   | BE + FE        | US-012a            |

### 2b. Lane B — AI Coach Productionization (16 SP)

| ID     | Title                                                      | SP  | Owner          | Depends            |
| ------ | ---------------------------------------------------------- | --- | -------------- | ------------------ |
| US-019 | AI Coach 1-1 GA — ramp 10%→100% PREMIUM, tier lock         | 5   | Senior BE      | S6 US-603 staged   |
| US-014 | Weekly Insight Digest — job + email + in-app banner        | 8   | BE + FE + Data | S5 US-503 insights |
| US-703 | Coach safety — prompt-injection guard + cost/abuse monitor | 3   | Security + BE  | US-019             |

### 2c. Cross-cutting & buffer (11 SP)

| ID     | Title                                                    | SP  | Owner      |
| ------ | -------------------------------------------------------- | --- | ---------- |
| US-704 | Strict TS rollout — `scenarios/`, `coach/` (FE + BE)     | 2   | Senior FE  |
| US-705 | A11y + visual regression — Scenario reader, Coach digest | 3   | QA + FE    |
| US-706 | Bug pool + post-release watch (v1.4.0-beta metrics)      | 3   | Whole team |
| US-707 | Retro action items + Sprint 8 prep                       | 1   | SM         |
| —      | Buffer                                                   | 2   | —          |

**Total: 21 (Lane A) + 16 (Lane B) + 11 (cross-cutting) = 48 SP.**

**Descope order nếu Day 7 burndown trailing:** US-704 → US-013 elimination view thu hẹp về explanation-only (−2 SP) → US-012c reasoning trace defer sang S8 (−2 SP) → US-014 thu hẹp về in-app banner only, bỏ email (−3 SP).

---

## 3. Decision Gates

### Gate 1: Scenario Quality (By Day 4)

Dựa trên RFC-011 spike data. Kiểm tra lại trên 20 scenario generate trong sprint.

| Điều kiện                                | Kết quả                                               |
| ---------------------------------------- | ----------------------------------------------------- |
| Quality score ≥ baseline single-question | ✅ GO — beta rollout full scope                       |
| Quality 70–90% baseline                  | ⚠️ CAUTION — ship beta nhưng gate sau human review    |
| Quality < 70% baseline                   | ❌ HOLD — US-012 thu về internal-only; tuning sang S8 |

**Owner:** Senior BE + PO. Ghi trong `docs/spikes/E4-scenario-engine.md` (update).

### Gate 2: AI Coach Cost at Scale (By Day 6)

| Điều kiện                       | Kết quả                                        |
| ------------------------------- | ---------------------------------------------- |
| Cost/session < $0.10 ở 50% ramp | ✅ GO — ramp lên 100% PREMIUM                  |
| Cost/session $0.10–$0.20        | ⚠️ CAUTION — giữ ở 50%, cap 5 sessions/ngày    |
| Cost/session > $0.20            | ❌ PAUSE — giữ 10%, re-model heuristic sang S8 |

**Owner:** Platform + Senior BE.

### Gate 3: Weekly Digest Opt-out Rate (By Day 9)

| Điều kiện          | Kết quả                           |
| ------------------ | --------------------------------- |
| Email opt-out < 5% | ✅ GO — full rollout              |
| Opt-out 5–15%      | ⚠️ giảm tần suất xuống 2 tuần/lần |
| Opt-out > 15%      | ❌ in-app only, tắt email         |

---

## 4. Day-by-Day Plan

### Week 1 (2026-06-29 → 07-03)

| Ngày    | Focus                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mon** | Planning 90'. US-012a: schema `Scenario` + `ScenarioAttempt` + migration. US-019: AI Coach ramp script + tier-lock guard. Feature flags provisioned.   |
| **Tue** | US-012a: BullMQ `scenario:generate` processor + prompt từ RFC-011. US-012b: ScenarioReader Storybook skeleton. US-014: digest job schema + query.      |
| **Wed** | US-012a: generate 20 scenario, đo quality + cost. US-019: ramp 10%→25% PREMIUM, cost panel live. US-013: per-option explanation generation.            |
| **Thu** | **Gate 1 (Scenario quality).** US-012b: passage + diagram render; reduced-motion check. US-014: email template + in-app banner. US-703 guard skeleton. |
| **Fri** | US-012c: scenario exam-mode wiring (timer, auto-submit). US-013: elimination view UI. US-019 ramp → 50%. US-704 strict-TS allow-list.                  |

### Week 2 (2026-07-06 → 07-10)

| Ngày    | Focus                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mon** | **Gate 2 (Coach cost).** US-012c: reasoning trace store + thinking-time analytics. US-014: digest staging send test. US-703 injection tests. |
| **Tue** | US-019 ramp → 100% PREMIUM (nếu Gate 2 go). US-012/013 E2E suite. US-705 axe + visual regression baselines.                                  |
| **Wed** | Code freeze. axe + visual + E2E gates green. **Gate 3 (digest opt-out).** Demo dry-run với PO. US-706 bug sweep.                             |
| **Thu** | **Release v1.4.0** — promote beta flags, ramp `FF_SCENARIO_ENGINE` beta cohort. Sprint Review + Retro. Sprint 8 prep seeded.                 |
| **Fri** | Post-release watch buffer; hotfix window nếu cần.                                                                                            |

---

## 5. Story Implementation Notes

### US-012a — Scenario schema + generation pipeline (5 SP, Senior BE)

Acceptance:

- Schema mới: `Scenario { id, certificationId, title, passageMarkdown, diagramUrl?, timeLimitSec?, status }` + `ScenarioQuestion { scenarioId, stem, options[], correctIndex, explanations[] }`.
- BullMQ processor `scenario:generate` dùng prompt template từ RFC-011 — sinh passage 200–400 từ + 3–5 contextual questions.
- Generation chạy `claude-haiku-4-5` (theo RFC-011 cost model); fallback `claude-sonnet-4-6` nếu quality gate fail.
- Mọi LLM call ghi `LlmUsageEvent` (đếm vào quota org).
- Migration reversible; rollback documented.

Files: `backend/prisma/schema.prisma`, `backend/src/scenarios/scenario.processor.ts`, `backend/src/scenarios/scenario.service.ts`, `backend/src/ai-question-bank/prompts/scenario-generator.prompt.ts`.

### US-012b — Scenario reader UI (6 SP, Senior FE + FE)

Acceptance (AC mẫu US-012 từ PO doc):

- _Given_ scenario có markdown + diagram URL, _When_ user mở, _Then_ render diagram + 4–6 đoạn context.
- Diagram lazy-load với explicit `width`/`height` (perf rule); reduced-motion respected.
- Reader mode a11y: semantic `<article>`, heading hierarchy, `aria-labelledby`.
- Visual regression baseline: 320/768/1024/1440 breakpoints.

Files: `src/components/scenarios/ScenarioReader.tsx`, `src/components/scenarios/ScenarioDiagram.tsx`, `src/pages/ScenarioPage.tsx`.

### US-012c — Scenario exam-mode (5 SP, FE + BE)

Acceptance:

- _Given_ scenario có time limit, _When_ hết giờ, _Then_ auto-submit + hiển thị "thinking time" analytics.
- Reasoning trace: lưu sequence option user chọn rồi đổi (`ScenarioAttempt.reasoningTrace` JSON).
- Tích hợp `ExamPage` engine sẵn có — mode `scenario`; mark-for-review hoạt động.

Files: `src/pages/ExamPage.tsx` (mode branch), `backend/src/scenarios/scenario.controller.ts`, `backend/test/scenarios/scenario.e2e-spec.ts`.

### US-013 — Per-option explanation logic (5 SP, BE + FE)

Acceptance (AC mẫu US-013):

- _Given_ user chọn answer, _When_ submit, _Then_ show explanation theo từng option (correct / distractor / marketing trap).
- Explanation generate cùng lúc với scenario (US-012a), lưu `ScenarioQuestion.explanations[]`.
- FE: elimination view — highlight vì sao mỗi option sai, dạy kỹ năng loại trừ.

Files: `backend/src/scenarios/scenario.service.ts` (explanation prompt), `src/components/scenarios/ExplanationPanel.tsx`.

### US-019 — AI Coach 1-1 GA (5 SP, Senior BE)

**Điều kiện: Gate 2 cost go.** Tiếp tục từ S6 US-603 (đã staged 10% PREMIUM, `FF_AI_COACH_HARDENED`).

Acceptance:

- Ramp `FF_AI_COACH_HARDENED`: 10% → 25% → 50% → 100% PREMIUM theo lịch day-by-day.
- Tier-lock: FREE user thấy locked state + upgrade CTA (không call LLM).
- Rate limit 10 sessions/ngày/PREMIUM giữ nguyên; 429 + `resetAt` + billing nudge.
- Rollback: `FF_AI_COACH_HARDENED=false` không cần deploy.

Files: `backend/src/coach/coach.controller.ts`, `backend/src/coach/coach.service.ts` (tier guard), `src/components/coach/CoachLockState.tsx`.

### US-014 — Weekly Insight Digest (8 SP, BE + FE + Data)

Acceptance (AC mẫu US-014):

- _Given_ user có proficiency + behavioral data, _When_ weekly job chạy, _Then_ sinh 1 insight tuần ("bạn yếu IAM khi đọc > 60 phút").
- Job `insights:weekly:digest` — chủ nhật 18:00, dùng `BehavioralInsight` data từ S5 US-503.
- Email template (responsive, `font-display: swap`, opt-out link) + in-app `<WeeklyDigestBanner />`.
- Opt-out persist `userSettings.weeklyDigestOptOut`; tôn trọng ở job query.
- Metric: `digest.sent`, `digest.opened`, `digest.opt_out`.

Files: `backend/src/insights/digest/digest.processor.ts`, `backend/src/mail/templates/weekly-digest.ts`, `src/components/dashboard/WeeklyDigestBanner.tsx`, `backend/test/insights/digest.e2e-spec.ts`.

### US-703 — Coach safety & monitoring (3 SP, Security Champion + BE)

Acceptance:

- Prompt-injection guard: sanitize user input, system-prompt isolation, reject pattern blocklist (theo SP-7 threat model).
- Abuse monitor: `coach.injection.blocked` counter; alert nếu > 1% requests.
- Grafana: cost/session, injection-block rate, abandonment rate.

Files: `backend/src/coach/coach.guard.ts`, `backend/test/coach/coach-injection.e2e-spec.ts`.

### US-704 — Strict TS rollout (2 SP, Senior FE)

- Thêm `scenarios/`, `coach/` (FE + BE) vào RFC-009 strict-TS allow-list; cập nhật status table.

### US-705 — A11y + visual regression (3 SP, QA + FE)

- axe-core gate trên `/scenarios/:id`, `/dashboard` (digest banner). Visual baselines 4 breakpoints. Lighthouse a11y ≥95, perf ≥85.

### US-706 — Bug pool + post-release watch (3 SP, whole team)

- Monitor v1.4.0-beta metrics: Coach D7 retention, daily challenge completion, burnout false-alert rate, RLS denial counter.

### US-707 — Retro + Sprint 8 prep (1 SP, SM)

- Sprint 8 candidates: Cross-Cert Knowledge Graph (US-017), Dynamic Difficulty (US-018), Peer Review Challenge (US-020), Exam Day Protocol (US-021), Benchmark vs top-10% (US-022) — v2.0 backlog grooming.

---

## 6. Cross-cutting Engineering Tasks

| Task                                                                    | Owner          | Deadline  |
| ----------------------------------------------------------------------- | -------------- | --------- |
| Feature flags: `FF_SCENARIO_ENGINE`; ramp config `FF_AI_COACH_HARDENED` | Platform       | Day 1     |
| Privacy doc: Scenario reasoning-trace + Weekly digest retention (90d)   | Tech Lead      | Day 3     |
| Grafana: scenario gen cost, Coach cost/session, digest open/opt-out     | Platform       | Day 5     |
| RFC-011 update với in-sprint quality data                               | Senior BE      | Day 4     |
| ADR-019: Scenario beta go/no-go                                         | PO + Tech Lead | EOD Day 4 |
| `docs/team-planning/sprint-07-execution-log.md` daily updates           | SM             | Daily     |

---

## 7. Definition of Done (Sprint 7 bổ sung)

Ngoài DoD chuẩn:

- **Zero `describe.skip` gate** (kế thừa từ S6) — CI fail nếu phát hiện.
- **LLM cost gate:** mọi feature gọi LLM phải ghi `LlmUsageEvent` và có Grafana panel trước khi ramp > 25%.
- **Scenario quality gate:** không ramp `FF_SCENARIO_ENGINE` quá beta-cohort nếu Gate 1 chưa GO.

---

## 8. Risks & Mitigations

| Risk                                                           | P×I | Mitigation                                                             | Owner             |
| -------------------------------------------------------------- | --- | ---------------------------------------------------------------------- | ----------------- |
| Scenario LLM quality không đạt baseline → Gate 1 HOLD          | M×H | RFC-011 spike đã de-risk; fallback Sonnet; internal-only ship nếu fail | Senior BE         |
| US-012 (16 SP combined) là lane lớn nhất → burndown trailing   | M×M | Descope order pre-planned; US-012c reasoning trace defer-able          | SM                |
| Coach cost spike khi ramp 100% PREMIUM                         | M×H | Gate 2 staged ramp; cap 5/ngày fallback; pause flag                    | Platform          |
| Weekly digest email opt-out cao → reputation/IP deliverability | M×M | Gate 3; double opt-in cho non-beta; in-app-only fallback               | BE                |
| Prompt injection vào Coach ở GA scale                          | L×H | US-703 guard + blocklist + monitor trước khi ramp > 50%                | Security Champion |
| Scenario diagram assets nặng → perf regression                 | L×M | Lazy-load, AVIF/WebP, explicit dimensions, Lighthouse gate             | FE                |

---

## 9. Capacity & Allocation

| Role              | Capacity (SP) | Allocated                                                   |
| ----------------- | ------------- | ----------------------------------------------------------- |
| Senior BE         | 11            | US-012a (5), US-019 (5), buffer (1)                         |
| BE                | 9             | US-013 BE (3), US-012c BE (2), US-014 BE (3), US-703 BE (1) |
| Senior FE         | 9             | US-012b (4), US-704 (2), polish (3)                         |
| FE                | 9             | US-012b (2), US-012c FE (3), US-013 FE (2), US-014 FE (2)   |
| Security Champion | 3             | US-703 guard + injection tests                              |
| Platform          | 3             | Feature flags, Grafana, cost gate                           |
| QA                | 3             | US-705 a11y + visual regression                             |
| Data              | 1             | US-014 digest query + insight selection                     |
| Whole team        | —             | US-706 bug pool (3, shared), US-707 (1 SM)                  |
| **Total**         | **48**        |                                                             |

---

## 10. Exit Checklist

### Lane A — Scenario Engine

- [ ] `Scenario` schema + migration merged; reversible.
- [ ] `scenario:generate` BullMQ job sinh passage + per-option explanations; `LlmUsageEvent` ghi nhận.
- [ ] Scenario reader render multi-paragraph + diagram; a11y ≥95; visual baselines committed.
- [ ] Scenario exam-mode: timer, auto-submit, reasoning trace lưu.
- [ ] Per-option explanation + elimination view live.
- [ ] `FF_SCENARIO_ENGINE` ở beta cohort; Gate 1 ADR-019 committed.

### Lane B — AI Coach

- [ ] `FF_AI_COACH_HARDENED` ramp lên 100% PREMIUM (hoặc 50% nếu Gate 2 caution).
- [ ] FREE user thấy locked state + upgrade CTA; tier guard verified.
- [ ] Weekly Insight Digest job chạy; email + in-app banner; opt-out hoạt động.
- [ ] US-703 prompt-injection guard active; injection E2E tests pass.
- [ ] Grafana: Coach cost/session, injection-block rate, digest open/opt-out live.

### Cross-cutting

- [ ] Strict TS: `scenarios/`, `coach/` thêm allow-list; RFC-009 cập nhật.
- [ ] axe + visual regression + Lighthouse green trên `/scenarios/:id`, `/dashboard`.
- [ ] Privacy docs cập nhật (reasoning-trace, digest retention).
- [ ] Zero `describe.skip`; coverage ≥80% trên module mới.
- [ ] v1.4.0 tagged; release notes published.
- [ ] Sprint Retro held; Sprint 8 prep seeded.
