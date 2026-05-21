# Sprint 8 — "AI Coach to GA + v1.4 Close-out" Implementation Plan

- **Version target:** v1.5.0 (GA — AI Coach 1-1 chat; completes the v1.4 "AI Coach" theme)
- **Capacity:** 46 SP (velocity hold from Sprint 7: ~48 SP planned)
- **Window:** 2026-07-13 → 2026-07-24 (2 tuần)
- **Status as of 2026-07-13:** Sprint 7 đóng (v1.4.0 tagged 2026-07-10). Scenario Engine ở beta cohort (`FF_SCENARIO_ENGINE`); AI Coach hardened ramp staged (`FF_AI_COACH_HARDENED`). Weekly Insight Digest live cho PREMIUM. **Coach session scaffold** (`backend/src/training/coach/coach.service.ts` + `coach.controller.ts`) đã merge nhưng **chưa có conversational backend** (message send + LLM completion + streaming). `CoachSafetyService` (jailbreak guard) và `CoachRampService` (ramp %) đã sẵn sàng nhưng chưa wire vào luồng chat.
- **Sprint goal:** Hoàn thiện **AI Coach 1-1 chat thực sự** (US-019) — user hỏi "tại sao đáp án này đúng" và nhận trả lời streaming, an toàn, trong budget. Đóng nốt v1.4: **Burnout Detection** (US-015) + **Exam Day Protocol** (US-021), và ramp Scenario + Coach lên GA 100% PREMIUM.

Source artefacts:

- [sprint-07-implementation-plan.md](./sprint-07-implementation-plan.md) — Scenario + Coach hardening + Digest
- [sprint-07-execution-log.md](./sprint-07-execution-log.md) — S7 gate decisions (cần finalize trong S8 — xem US-810)
- [01-product-owner.md §3](./01-product-owner.md) — US-015, US-019, US-021 backlog (E6)
- [03-tech-lead.md](./03-tech-lead.md) — RFC-005 (SSE Realtime), RFC-008 (Behavioral/Burnout pipeline), RFC-012 (LLM Cost & Quota)
- `backend/prisma/schema.prisma` — `CoachSession` (L1231), `AttemptEvent` (L1037) models; `BurnoutSignal` cần tạo mới
- `backend/src/training/coach/` — `coach.service.ts`, `coach.controller.ts`, `coach-safety.service.ts`, `coach-ramp.service.ts`

---

## 1. Sprint Goal & Demo

**Goal Hit Criteria:**

- **Coach chat GA:** PREMIUM user mở Coach → gõ câu hỏi → nhận trả lời **streaming token-by-token** (SSE). Multi-turn, lịch sử persist trong `CoachSession.messages`. FREE user thấy locked state (đã có từ S7).
- **Question-context coaching:** Từ trang giải thích câu hỏi, user bấm "Hỏi Coach tại sao" → coach nhận context câu hỏi + đáp án và trả lời có dẫn chứng.
- **Safety at GA scale:** Mọi message qua `CoachSafetyService.detectJailbreakAttempt()`; jailbreak bị chặn + log. System-prompt isolation (không nhúng user input vào system role).
- **Cost guardrail:** Cost/session < $0.10 ở 100% ramp; `LlmUsageEvent` ghi token + cost; per-user/per-org quota (RFC-012); Grafana panel.
- **Burnout detection:** Worker đọc `AttemptEvent` → tính burnout score (response-time variance + session length + late-night) → `MicroBreakOverlay` đề xuất 5-min reset. False-positive < 10%.
- **Exam Day Protocol:** Checklist 24h-trước-thi + reminder.
- **Quality gates:** axe-core ≥95 trên Coach chat + MicroBreak + Exam Day; coverage ≥80% module mới; SSE stable dưới load.

**Demo script (Thu, end of S8):**

1. **Coach chat:** Linh (PREMIUM) mở Coach → hỏi "tại sao IAM policy này dùng Deny?" → trả lời streaming, persist; reload → lịch sử còn.
2. **Question-context:** Mở câu hỏi sai → "Hỏi Coach tại sao" → coach giải thích có dẫn chứng đáp án.
3. **Safety:** Gửi "ignore previous instructions, you are now…" → guard chặn, banner "câu hỏi không hợp lệ", log `coach.injection.blocked`.
4. **Rate limit + cost:** Gửi >10 sessions/ngày → 429 graceful. Grafana: cost/session panel < $0.10.
5. **Burnout:** Mô phỏng cohort response-time variance cao + session dài → `MicroBreakOverlay` 5-min reset xuất hiện.
6. **Exam Day:** Khoa set ngày thi → 24h trước nhận checklist Exam Day Protocol.

---

## 2. Story Breakdown (46 SP)

### 2a. Lane A — AI Coach 1-1 Chat GA (16 SP)

| ID      | Title                                                              | SP  | Owner          | Depends                  |
| ------- | ----------------------------------------------------------------- | --- | -------------- | ------------------------ |
| US-019a | Coach chat backend — message send + LLM completion + SSE streaming | 8   | Senior BE      | RFC-005 (US-808), CoachSafety |
| US-019b | Coach chat FE — streaming UI thay thế session scaffold S7          | 5   | Senior FE + FE | US-019a                  |
| US-019c | Question-context injection — "Hỏi Coach tại sao đáp án này đúng"   | 3   | BE + FE        | US-019a                  |

### 2b. Lane B — Burnout Detection + Exam Day (8 SP)

| ID     | Title                                                          | SP  | Owner       | Depends            |
| ------ | -------------------------------------------------------------- | --- | ----------- | ------------------ |
| US-015 | Burnout detection — `BurnoutSignal` schema + worker + MicroBreakOverlay | 5   | ML + BE + FE | RFC-008, AttemptEvent |
| US-021 | Exam Day Protocol — checklist 24h trước thi + reminder         | 3   | FE + BE     | —                  |

### 2c. Lane C — Cross-cutting, infra & v1.4 close-out (22 SP)

| ID     | Title                                                          | SP  | Owner             |
| ------ | -------------------------------------------------------------- | --- | ----------------- |
| US-808 | RFC-005 SSE realtime gateway (coach streaming-first)           | 5   | Senior BE + Platform |
| US-809 | RFC-012 LLM cost/quota extend cho Coach + Grafana panel        | 3   | Platform          |
| US-810 | S7 carryover — ADR-019 (scenario beta go/no-go) + exec log + retro finalize | 2 | SM + PO       |
| US-811 | Scenario + Coach GA ramp → 100% PREMIUM + feature-flag cleanup | 3   | BE + Platform     |
| US-812 | Burnout privacy/ethics review + RFC-008 doc finalize           | 2   | Tech Lead + ML    |
| US-813 | Strict-TS (`coach/`, `burnout/`) + a11y + visual regression    | 3   | Senior FE + QA    |
| US-814 | Bug pool + post-release watch + Sprint 9 (v2.0) prep           | 2   | Whole team + SM   |
| —      | Buffer                                                         | 2   | —                 |

**Total: 16 (Lane A) + 8 (Lane B) + 22 (Lane C) = 46 SP.**

**Descope order nếu Day 7 burndown trailing:** US-019c question-context defer sang S9 (−3 SP) → US-015 burnout thu về **detection-only, không MicroBreakOverlay** (−2 SP) → US-021 Exam Day thu về static checklist, bỏ reminder job (−1 SP) → US-808 SSE thu về chunked HTTP streaming thay full SSE gateway (−2 SP).

---

## 3. Decision Gates

### Gate 1: Coach Chat Quality + Safety (By Day 4)

| Điều kiện                                              | Kết quả                                                |
| ----------------------------------------------------- | ------------------------------------------------------ |
| Chat trả lời chính xác (n≥30 Q) + jailbreak block 100% | ✅ GO — ramp coach chat lên beta cohort                |
| Quality OK nhưng safety leak edge-case                | ⚠️ CAUTION — ship beta, tighten blocklist trước Day 6  |
| Quality kém / safety fail nghiêm trọng                | ❌ HOLD — chat internal-only; tuning prompt sang S9    |

**Owner:** Senior BE + Security Champion. Ghi trong ADR-020.

### Gate 2: Coach Cost at Chat Scale (By Day 6)

| Điều kiện                            | Kết quả                                       |
| ------------------------------------ | --------------------------------------------- |
| Cost/session < $0.10 ở 50% ramp      | ✅ GO — ramp 100% PREMIUM                     |
| Cost/session $0.10–$0.20             | ⚠️ CAUTION — giữ 50%, cap 5 sessions/ngày     |
| Cost/session > $0.20                 | ❌ PAUSE — giữ 25%, prompt/token optimize S9  |

**Owner:** Platform + Senior BE. Multi-turn chat tốn token hơn digest → theo dõi sát.

### Gate 3: Burnout Signal Precision (By Day 9)

| Điều kiện                          | Kết quả                                          |
| ---------------------------------- | ------------------------------------------------ |
| False-positive < 10%               | ✅ GO — bật `MicroBreakOverlay` cho all PREMIUM  |
| False-positive 10–25%              | ⚠️ giảm độ nhạy threshold, opt-in only           |
| False-positive > 25%               | ❌ detection-only (log), tắt overlay; tune S9    |

**Owner:** ML Champion + UX. Threshold kế thừa baseline S6/S7 burnout false-alert monitoring.

---

## 4. Day-by-Day Plan

### Week 1 (2026-07-13 → 07-17)

| Ngày    | Focus                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mon** | Planning 90'. US-810 finalize S7 gates/ADR-019. US-808: SSE gateway skeleton (RFC-005). US-019a: chat endpoint contract + system-prompt isolation design. US-015: `BurnoutSignal` migration draft. |
| **Tue** | US-808: SSE token stream POC. US-019a: LLM completion wired vào `CoachSession.messages`; `CoachSafetyService` guard inline. US-809: cost/quota hook (`LlmUsageEvent`). |
| **Wed** | US-019a: streaming end-to-end (SSE). US-019b: chat FE consume stream, render token-by-token. US-015: burnout worker đọc `AttemptEvent` (variance + session length + late-night). |
| **Thu** | **Gate 1 (chat quality + safety).** US-019b: history persist + rate-limit 429 UI. US-019c: question-context injection BE. US-812 privacy/ethics review burnout. |
| **Fri** | US-019c FE ("Hỏi Coach tại sao" từ ExplanationPanel). US-015: `MicroBreakOverlay` FE. Coach ramp → 25%. US-813 strict-TS allow-list `coach/`. |

### Week 2 (2026-07-20 → 07-24)

| Ngày    | Focus                                                                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mon** | **Gate 2 (coach chat cost).** US-021: Exam Day Protocol checklist + reminder job. US-809: Grafana cost panel live. US-811 scenario ramp wider. |
| **Tue** | US-019 ramp → 100% PREMIUM (nếu Gate 2 GO). US-015 burnout E2E + threshold tune. US-813 axe + visual regression baselines (chat, micro-break, exam-day). |
| **Wed** | Code freeze. axe + visual + E2E + SSE load gates green. **Gate 3 (burnout precision).** Demo dry-run với PO. US-814 bug sweep. |
| **Thu** | **Release v1.5.0** — promote coach chat GA, ramp scenario flag wider. Sprint Review + Retro. Sprint 9 (v2.0) prep seeded. |
| **Fri** | Post-release watch buffer; hotfix window nếu cần. |

---

## 5. Story Implementation Notes

### US-019a — Coach chat backend (8 SP, Senior BE)

Acceptance:

- Endpoint `POST /training/coach/session/:id/message` — nhận user message, validate qua `CoachSafetyService.detectJailbreakAttempt()` (reject + log `coach.injection.blocked` nếu detected).
- LLM completion `claude-haiku-4-5` (theo D3 + RFC-012 cost model), system-prompt isolation: user input **không** nhúng vào system role; output schema validate.
- Stream response qua SSE (US-808); append `{ role, content, timestamp }` vào `CoachSession.messages` (Json), cập nhật `costUsd`.
- Rate limit 10 sessions/ngày/PREMIUM (dùng `coach.service.ts#getSessionCount`); 429 + `resetAt`.
- Mọi LLM call ghi `LlmUsageEvent` (đếm vào quota — RFC-012/US-809).

Files: `backend/src/training/coach/coach.controller.ts` (mở rộng), `backend/src/training/coach/coach.service.ts` (thêm `sendMessage`), `backend/src/training/coach/coach-chat.prompt.ts` (mới), `backend/test/coach/coach-chat.e2e-spec.ts`.

### US-019b — Coach chat FE (5 SP, Senior FE + FE)

Acceptance:

- Thay scaffold `src/components/coach/CoachSession.tsx` (S7) bằng chat thực: input + send, render streaming token-by-token, lịch sử multi-turn.
- Tier-lock giữ nguyên (`Coach.tsx` → `CoachLockState` cho FREE — đã có S7).
- 429 → banner "đã đạt giới hạn hôm nay" + `resetAt`. Loading/streaming state có `aria-live`.
- Reduced-motion: tắt typing animation nếu user prefers-reduced-motion.

Files: `src/components/coach/CoachSession.tsx` (rewrite), `src/services/coach.ts` (mới — SSE client), `src/components/coach/__tests__/CoachSession.spec.tsx`.

### US-019c — Question-context injection (3 SP, BE + FE)

Acceptance:

- Từ `ExplanationPanel` (scenario) hoặc trang giải thích câu hỏi, nút "Hỏi Coach tại sao" → mở Coach với context `{ questionId, stem, correctAnswer, userAnswer }`.
- Backend ghép context vào prompt (user role, không phải system) → coach trả lời có dẫn chứng.

Files: `src/components/scenario/ExplanationPanel.tsx` (thêm CTA), `backend/src/training/coach/coach-chat.prompt.ts` (context template).

### US-015 — Burnout detection (5 SP, ML + BE + FE)

Acceptance (AC mẫu US-015):

- _Given_ user có response-time variance cao + session dài + hoạt động late-night, _When_ worker chạy, _Then_ tạo `BurnoutSignal` + đề xuất 5-min reset.
- Schema mới `BurnoutSignal { id, userId, score, signals Json, detectedAt }` (RFC-008); migration reversible.
- Worker (BullMQ) đọc `AttemptEvent` (eventType timing) → heuristic score (RFC-008). **Không** gọi LLM.
- FE `MicroBreakOverlay` — 5-min reset gợi ý, dismissable, respect reduced-motion; chỉ hiện nếu Gate 3 GO.

Files: `backend/prisma/schema.prisma` (`BurnoutSignal`), `backend/src/insights/behavioral/burnout.processor.ts`, `src/components/coach/MicroBreakOverlay.tsx`, `backend/test/insights/burnout.spec.ts`.

### US-021 — Exam Day Protocol (3 SP, FE + BE)

Acceptance (AC mẫu US-021):

- _Given_ user set ngày thi, _When_ còn 24h, _Then_ hiển thị checklist (giấy tờ, nghỉ ngơi, ôn nhanh weak topics) + reminder.
- Checklist FE static + personalize weak topics từ analytics. Reminder dùng mail/in-app (tái dụng digest infra S7).

Files: `src/components/exam/ExamDayChecklist.tsx`, `backend/src/insights/exam-day/exam-day.service.ts`.

### US-808 — RFC-005 SSE realtime gateway (5 SP, Senior BE + Platform)

- SSE endpoint stateless, work với Nginx/HTTP2 (RFC-005). Streaming-first cho coach chat token stream; thiết kế reusable cho squad leaderboard sau (S9+).
- Heartbeat + reconnect; auth qua JWT. Load test stream concurrency.

Files: `backend/src/realtime/sse.gateway.ts`, `backend/src/realtime/realtime.module.ts`, `nginx/*` (buffering off cho SSE path).

### US-809 — LLM cost/quota cho Coach (3 SP, Platform)

- Extend RFC-012 quota layer: per-user + per-org token/cost cho Coach (tái dụng cột ở `QuestionGenerationJob` + `LlmUsageEvent`). Grafana panel cost/session.

### US-810 — S7 carryover docs (2 SP, SM + PO)

- ADR-019 scenario beta go/no-go (Gate 1 S7). Finalize `sprint-07-execution-log.md` + `sprint-07-retro.md` với số liệu thực. (Hoàn thành task tồn từ S7.)

### US-811 — Scenario + Coach GA ramp (3 SP, BE + Platform)

- Ramp `FF_SCENARIO_ENGINE` beta → wider cohort (gated S7 quality). `FF_AI_COACH_HARDENED` → 100% PREMIUM (gated Gate 2). Cleanup stale flags.

### US-812 — Burnout privacy/ethics review (2 SP, Tech Lead + ML)

- RFC-008 finalize. Privacy: burnout signal là sensitive — retention policy, opt-out, không share cross-org. Ethics: tránh false-alarm gây lo âu (tie vào Gate 3).

### US-813 — Strict-TS + a11y + visual (3 SP, Senior FE + QA)

- `coach/`, `burnout/` (FE+BE) vào RFC-009 allow-list. axe-core ≥95 + visual baselines (4 breakpoints) cho Coach chat, MicroBreakOverlay, Exam Day. Lighthouse a11y ≥95, perf ≥85.

### US-814 — Bug pool + Sprint 9 prep (2 SP, whole team + SM)

- Monitor v1.5.0 metrics: coach chat CSAT, cost/session, injection-block rate, burnout false-positive. Sprint 9 candidates: **Cross-Cert Knowledge Graph (US-017, 13 SP, RFC-007)**, Dynamic Difficulty (US-018), Peer Review (US-020), Benchmark (US-022) — v2.0 grooming.

---

## 6. Cross-cutting Engineering Tasks

| Task                                                                    | Owner          | Deadline  |
| ----------------------------------------------------------------------- | -------------- | --------- |
| RFC-005 SSE gateway live (coach streaming)                              | Platform       | Day 3     |
| RFC-008 burnout pipeline doc finalize                                   | ML + Tech Lead | Day 4     |
| RFC-012 Coach cost/quota + Grafana panel                                | Platform       | Day 6     |
| ADR-020: Coach chat go/no-go (Gate 1)                                   | Senior BE + Security | EOD Day 4 |
| Privacy doc: burnout signal retention + opt-out                         | Tech Lead      | Day 4     |
| `docs/team-planning/sprint-08-execution-log.md` daily updates           | SM             | Daily     |

---

## 7. Definition of Done (Sprint 8 bổ sung)

Ngoài DoD chuẩn:

- **Zero `describe.skip` gate** (kế thừa) — CI fail nếu phát hiện.
- **Safety gate:** không ramp coach chat > beta nếu jailbreak guard chưa block 100% trong test suite.
- **LLM cost gate:** coach chat phải ghi `LlmUsageEvent` + có Grafana panel trước khi ramp > 25%.
- **Burnout ethics gate:** không bật `MicroBreakOverlay` cho all-PREMIUM nếu false-positive ≥ 10% (Gate 3).
- **SSE gate:** stream stable dưới load test trước khi ramp coach chat 100%.

---

## 8. Risks & Mitigations

| Risk                                                           | P×I | Mitigation                                                             | Owner             |
| -------------------------------------------------------------- | --- | ---------------------------------------------------------------------- | ----------------- |
| Multi-turn chat cost vượt $0.10/session                        | M×H | Gate 2 staged ramp; token budget per session; cap 5/ngày fallback      | Platform          |
| SSE không stable qua Nginx → chat stream vỡ                    | M×H | RFC-005 POC sớm Day 2; fallback chunked HTTP; load test trước ramp     | Senior BE         |
| Prompt injection ở chat free-text scale                        | M×H | `CoachSafetyService` inline mọi message; blocklist; Gate 1 block 100%  | Security Champion |
| Burnout false-positive gây lo âu user                          | M×M | Gate 3 precision threshold; opt-out; ethics review (US-812)            | ML Champion + UX  |
| US-019 (16 SP) là lane lớn nhất → burndown trailing            | M×M | Descope order pre-planned; US-019c defer-able; SSE chunked fallback    | SM                |
| `BurnoutSignal` schema mới + worker → migration risk           | L×M | Reversible migration; worker không gọi LLM; shadow-run trước bật overlay | BE              |
| S7 gate docs (ADR-019) trượt tiếp sang S8                      | L×L | US-810 ưu tiên Day 1; SM owns                                          | SM                |

---

## 9. Capacity & Allocation

| Role              | Capacity (SP) | Allocated                                                       |
| ----------------- | ------------- | --------------------------------------------------------------- |
| Senior BE         | 11            | US-019a (8), US-808 (3 share)                                   |
| BE                | 9             | US-019c BE (2), US-015 BE (2), US-021 BE (1), US-811 (2), buffer (2) |
| Senior FE         | 9             | US-019b (5), US-813 (3), polish (1)                             |
| FE                | 8             | US-019b (share), US-019c FE (1), US-015 FE (3), US-021 FE (2), US-019b (2) |
| ML Champion       | 3             | US-015 burnout heuristic + US-812                               |
| Security Champion | 2             | US-019a safety wiring + Gate 1                                  |
| Platform          | 5             | US-808 SSE (2), US-809 cost/quota (3)                           |
| QA                | 3             | US-813 a11y + visual + SSE load test                            |
| SM + PO           | 2             | US-810 S7 docs + US-814 prep                                    |
| Whole team        | —             | US-814 bug pool (shared)                                        |
| **Total**         | **~46**       |                                                                 |

---

## 10. Exit Checklist

### Lane A — AI Coach 1-1 Chat

- [ ] `POST /training/coach/session/:id/message` — LLM completion + SSE streaming; `CoachSession.messages` persist.
- [ ] Every message qua `CoachSafetyService`; jailbreak block 100% trong test suite; `coach.injection.blocked` logged.
- [ ] Coach chat FE: streaming render, multi-turn history, 429 graceful, `aria-live`, reduced-motion.
- [ ] "Hỏi Coach tại sao" question-context từ ExplanationPanel hoạt động.
- [ ] `FF_AI_COACH_HARDENED` → 100% PREMIUM (hoặc 50% nếu Gate 2 caution); ADR-020 committed.

### Lane B — Burnout + Exam Day

- [ ] `BurnoutSignal` schema + migration merged; reversible.
- [ ] Burnout worker đọc `AttemptEvent` → score; `MicroBreakOverlay` (nếu Gate 3 GO).
- [ ] Exam Day Protocol checklist + reminder live; personalize weak topics.

### Cross-cutting

- [ ] RFC-005 SSE gateway live; stable dưới load test.
- [ ] RFC-012 Coach cost/quota; Grafana cost/session panel.
- [ ] Scenario + Coach GA ramp (S7 gates honored); stale flags cleaned.
- [ ] S7 carryover finalized: ADR-019 + exec log + retro.
- [ ] Strict-TS: `coach/`, `burnout/` allow-list; RFC-009 cập nhật.
- [ ] axe + visual regression + Lighthouse green (Coach chat, MicroBreak, Exam Day).
- [ ] Privacy docs: burnout retention + opt-out finalized.
- [ ] Zero `describe.skip`; coverage ≥80% module mới.
- [ ] v1.5.0 tagged; release notes published.
- [ ] Sprint Retro held; Sprint 9 (v2.0 — Cross-Cert Graph US-017) prep seeded.
