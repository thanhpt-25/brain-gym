# 00 — Master Roadmap: CertGym (Brain Gym) Q2–Q4 2026

> **Tổng hợp** từ 4 góc nhìn của Scrum team: Product Owner, Scrum Master, Tech Lead, UX/QA Lead.
> Mỗi vai trò có deliverable riêng (file 01–04). File này là **sự đồng thuận** + **traceability** giữa các quyết định.

---

## 📚 Bộ tài liệu

| File                                       | Vai trò       | Nội dung chính                                                                                                                            |
| ------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [01-product-owner.md](01-product-owner.md) | Product Owner | 4 personas, 8 epics, 22 user stories (US-001…US-022), release plan v1.1→v2.0, 5 OKRs Q3                                                   |
| [02-scrum-master.md](02-scrum-master.md)   | Scrum Master  | Team 6 dev / 5.5 FTE, 40 SP/sprint, DoR/DoD, 10 risks, sprint 1–3 plan, 10 process improvements                                           |
| [03-tech-lead.md](03-tech-lead.md)         | Tech Lead     | Bounded contexts, 12 RFCs (RFC-001…RFC-012), 6 schema models mới, infra roadmap, top 10 tech debt, 7 spikes                               |
| [04-ux-qa-lead.md](04-ux-qa-lead.md)       | UX/QA Lead    | Editorial + Dark luxury direction, 10 components mới, test pyramid, 10 a11y gap WCAG 2.2 AA, perf budget, 250 visual regression baselines |

---

## 1. Executive Summary

### Vấn đề

CertGym đã có **MVP rộng** (40+ Prisma models, 23 page FE, multi-tenant org, AI generator, flashcard SRS) nhưng mới phủ **~50% vision** từ `docs/vision.md`. Khoảng cách lớn nhất: **không có moat khác biệt** so với Whizlabs/ExamTopics — chưa biến từ "question bank" thành "training system".

### Hướng đi (3 quý)

1. **Q2** — Vững nền: stabilize CI, kích hoạt **Question SRS** (schema có sẵn nhưng chưa wire), event sourcing.
2. **Q3** — Build moat: **Pass Predictor** (Readiness Score) + Behavioral Insights + Scenario Simulation.
3. **Q4** — Retention engine: **Training Squads** + Cross-Cert Knowledge Graph + AI Coach 1-1.

### Tin chính

- 🔴 **Blocker tech debt** phải giải quyết trong Sprint 1–2 trước khi Q3 feature khởi động (event store, job queue, multi-tenant RLS, TS strict pilot).
- 🟢 Schema đã có **`ReviewSchedule`** cho Question SRS nhưng chưa wire — quick win 1 sprint (RFC-002 + US-003/US-004).
- 🟡 **Pass Predictor** bắt đầu bằng **heuristic v0** (RFC-003), không phải ML — đủ giá trị cho launch Q3.
- 🟡 **LLM cost** sẽ là biến số tài chính lớn nhất khi scale — cần `LlmUsageEvent` + per-feature dashboard từ Sprint 2.

---

## 2. Roadmap Tổng hợp (Quarter View)

```
Q2 2026                  Q3 2026                  Q4 2026
────────────────────     ────────────────────     ────────────────────
Sprint 1–4               Sprint 5–8               Sprint 9–12
v1.1 → v1.2              v1.3 → v1.4              v2.0
──────────────────       ──────────────────       ──────────────────
Foundation +             Build the Moat           Retention Engine
Question SRS             ──────────────────       ──────────────────
──────────────────       Pass Predictor v1        Squads
Stabilize CI             Behavioral Insights      Cross-Cert Graph
Event store              Scenario Simulation      AI Coach 1-1
SRS activation           AI Coach Beta            DDS
Time Pressure mode       Reviewer Queue           Peer Review
                         Reviewer Queue           Exam Day Protocol
```

### Mapping Epic → US → RFC → UX/QA artifact

| Epic                       | User Stories                   | RFCs cần                  | UX artifact                                           | Test focus                                             |
| -------------------------- | ------------------------------ | ------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| **E1 Pass Predictor**      | US-001, US-002, US-022         | RFC-001, RFC-003          | ReadinessGauge + DomainBentoCard, Editorial dashboard | Predictor accuracy (corr ≥ 0.75), 250 visual baselines |
| **E2 Question SRS**        | US-003, US-004, US-007, US-016 | RFC-001, RFC-002          | SrsRatingBar, ForgettingCurve, Daily Review flow      | SM-2 unit test, 25 SRS card/user/day load              |
| **E3 Adaptive Training**   | US-006, US-018                 | RFC-002, RFC-007          | Adaptive suggest carousel                             | Edge-of-competence A/B test                            |
| **E4 Scenario Simulation** | US-012, US-013                 | (content team owned)      | Scenario reader (multi-paragraph + diagram)           | A11y reader mode, perf for diagrams                    |
| **E5 Training Squads**     | US-009, US-010, US-011, US-020 | RFC-005, RFC-011          | SquadRankRow, ActivityFeedItem                        | Realtime SSE leaderboard load test                     |
| **E6 AI Coach + Burnout**  | US-014, US-015, US-019, US-021 | RFC-008, RFC-010, RFC-012 | CoachChat, MicroBreakOverlay                          | Prompt injection threat model (SP-7)                   |
| **E7 Cross-Cert Graph**    | US-017                         | RFC-007                   | Graph viz (D3 / Cytoscape)                            | Vector dedup quality                                   |
| **E8 Time Pressure Mode**  | US-005, US-008                 | (no new RFC)              | Timer + warning state                                 | Reduced-motion + a11y aria-live                        |

---

## 3. Sprint 1–3 — Đồng thuận chi tiết

### Sprint 1 — "Stabilize the Gym" (capacity 40 SP) · v1.1.0 ✅ DONE

| Lane              | Stories / Tasks (SM)                                                     | Liên quan US (PO)         | RFC / Spike (Tech) | UX/QA                    | Status  |
| ----------------- | ------------------------------------------------------------------------ | ------------------------- | ------------------ | ------------------------ | ------- |
| **Tech Debt**     | US-101 fix E2E isolation, US-102 strict TS pilot (`services/` + `auth/`) | —                         | SP-6, RFC-009      | E2E quarantine flow      | ✅ Done |
| **Foundation**    | US-103 SRS schema + migration, US-104 Flashcard review API               | US-003, US-004 (chuẩn bị) | RFC-002 schema     | SM-2 unit test           | ✅ Done |
| **Security**      | US-105 CSP nonce + DOMPurify                                             | —                         | —                  | CSP gate ở Lighthouse CI | ✅ Done |
| **Spike**         | US-106 BullMQ feasibility                                                | —                         | RFC-004, SP-2      | —                        | ✅ Done |
| **Foundation FE** | US-108 Lighthouse CI baseline                                            | —                         | —                  | Perf budget gate         | ✅ Done |
| **Bug pool**      | US-107 (4 SP)                                                            | —                         | —                  | —                        | ✅ Done |

**Demo:** ✅ CI pipeline xanh 5 lần liên tiếp, flashcard review API qua Postman, Lighthouse baseline.
**Goal Hit Criteria:** ✅ flaky e2e xuống 0 (quarantine registry + isolation helpers), ✅ schema migration xanh staging (SM-2 fields on ReviewSchedule), ✅ BullMQ POC chạy được 1 job (ADR-001 merged).
**Actual outcomes:** PR template + on-call runbook + working agreement committed (`docs/working-agreement.md`, `docs/oncall.md`). CSP shipped as `report-only` (hardening sprint 3+). `noImplicitAny: false` retained but `any` banned via ESLint in new modules.

### Sprint 2 — "First Learner Loop" (capacity 42 SP) · v1.1.1 ✅ DONE

| Lane           | Stories / Tasks                                                             | Liên quan US   | RFC / Spike     | UX/QA                                        | Status  |
| -------------- | --------------------------------------------------------------------------- | -------------- | --------------- | -------------------------------------------- | ------- |
| **Feature FE** | US-201 Flashcard review UI, US-202 Due-today widget                         | US-003, US-004 | —               | SrsRatingBar component, Daily Review journey | ✅ Done |
| **Feature BE** | US-203 SM-2 polish + unit test                                              | US-003         | RFC-002 wrap up | SM-2 algorithm spec                          | ✅ Done |
| **Platform**   | US-206 BullMQ production (AI gen worker), US-204 index tuning + k6 10k user | —              | RFC-004         | Load test target p95 < 300ms                 | ✅ Done |
| **QA**         | US-205 Visual regression Playwright (5 page × 3 breakpoint)                 | —              | —               | 250 baseline mục tiêu                        | ✅ Done |
| **Tech debt**  | US-207 `api.ts` interceptor unit test                                       | —              | —               | —                                            | ✅ Done |

**Demo:** ✅ học viên thật làm 20 flashcard, due queue cập nhật, Playwright screenshots diff = 0, k6 report 10k user.
**Goal Hit Criteria:** ✅ Question SRS wired end-to-end (schema + API + UI), ✅ BullMQ production (AI gen worker running on Redis queue), ✅ visual regression baseline committed, ✅ `api.ts` interceptor covered by unit tests.
**Actual outcomes:** SM-2 pure function (`sm2.ts`) extracted and unit tested. BullMQ queue name fix merged post-sprint. `intervalDays` field rename resolved across schema + API + tests.

### Sprint 3 — "Insight Kickoff" (capacity 44 SP) · v1.2.0-alpha

| Lane                   | Stories / Tasks                                       | Liên quan US      | RFC / Spike    | UX/QA                                        |
| ---------------------- | ----------------------------------------------------- | ----------------- | -------------- | -------------------------------------------- |
| **Foundation**         | US-301 AttemptEvent schema, US-302 ingestion endpoint | US-001 (chuẩn bị) | **RFC-001** GA | Privacy review, telemetry contract           |
| **Feature FE**         | US-303 Mastery dashboard v1, US-304 streak edge-case  | US-002 (chuẩn bị) | —              | DomainBentoCard, editorial direction kickoff |
| **Knowledge transfer** | US-305 exam engine doc + pair tour                    | —                 | —              | Bus factor mitigation (R5)                   |
| **A11y**               | US-306 fix top-10 a11y issue                          | —                 | —              | UX/QA roadmap §7                             |
| **Spike**              | US-307 Pass Predictor feature definition              | US-001 spec       | **SP-4**       | Heuristic notebook                           |
| **Bug + retro**        | US-308, US-309                                        | —                 | —              | —                                            |

**Demo:** event flow end-to-end (FE action → BE event → dashboard query), mastery dashboard với data thật, Pass Predictor v0 spec presentation.
**Goal Hit Criteria:** ≥10k events/ngày ingest stable, RFC-003 approved, DAU/MAU ≥ 28% (target Q3 35%).

---

## 4. Key Decisions cần PO chốt (deadline 2026-05-05)

| #   | Decision                                                                               | Recommendation                                                          | Tradeoff                                                                                   |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| D1  | **Tier hóa Pass Predictor**: Free hay Premium-only?                                    | **Premium-only** từ v1.2; free user thấy "blurred score + unlock CTA"   | Premium tăng conversion nhưng giảm viral. Recommend premium vì là moat.                    |
| D2  | **Realtime infra** cho Squad: Pusher (managed $) hay self-host SSE?                    | **SSE-first** (RFC-005), migrate khi >1k concurrent                     | SSE rẻ + work với Nginx; Pusher nhanh hơn để launch nhưng lock-in                          |
| D3  | **AI Coach LLM provider**: Anthropic Haiku 4.5 hay OpenAI mini?                        | **Haiku 4.5** — theo `common/performance.md`, rẻ + đủ tốt cho coach 1-1 | Haiku rẻ hơn 60% nhưng cần benchmark CSAT                                                  |
| D4  | **Sprint 1 có hoãn feature không?**                                                    | **CÓ** — full sprint cho stabilization                                  | 2 tuần delay roadmap nhưng tránh ăn nợ trong Q3                                            |
| D5  | **Squad là sub-type của Org hay model riêng?**                                         | **Sub-type Organization** (RFC-011)                                     | Tận dụng infra có sẵn, tránh duplicate code; constraint: Squad không có Catalog/Assessment |
| D6  | **Open beta cohort cho Pass Predictor**: 200 user ở Sprint 4 hay đợi 1k user Sprint 6? | **200 user Sprint 4** + opt-in feedback survey                          | Validate sớm, accept noise                                                                 |

---

## 5. Risk Heatmap (tổng hợp)

| Risk                                                  | Source               | P×I | Owner             | Mitigation Sprint                     | Status (post-S2)                                                 |
| ----------------------------------------------------- | -------------------- | --- | ----------------- | ------------------------------------- | ---------------------------------------------------------------- |
| Event store thiếu → block Predictor + Coach + Burnout | Tech Lead R1         | H×H | Tech Lead         | RFC-001 trong Sprint 1, GA Sprint 3   | 🟡 Sprint 3 (on track)                                           |
| E2E flaky chặn CI                                     | SM R2                | H×H | QA                | Sprint 1 — isolation + quarantine     | ✅ MITIGATED — S1 done                                           |
| Multi-tenant data leak                                | SM R4 + Tech R3      | L×H | Senior BE         | RFC-006 RLS Sprint 4–5                | 🔵 OPEN — Sprint 4–5                                             |
| LLM cost runaway                                      | Tech R6 cost         | M×H | Platform          | RFC-012 Sprint 2                      | 🟡 Partially — BullMQ limits job scope; RFC-012 pending Sprint 3 |
| Pass Predictor data quá ít → overfit                  | SM R7                | M×H | PO + BE           | Lùi launch nếu < 1k attempt           | 🔵 OPEN — monitoring                                             |
| TS loose introduce runtime bug khó trace              | SM R1 + Tech debt #5 | H×H | Senior FE         | RFC-009 + ESLint no-new-any rule      | 🟡 IN PROGRESS — pilot done (services/auth); rolling out         |
| Bus factor exam engine = 1                            | SM R5                | M×H | SM                | US-305 doc + pair tour Sprint 3       | 🔵 OPEN — scheduled Sprint 3                                     |
| Burnout content team (Scenarios)                      | Implicit từ E4       | M×H | PO                | Outsource scenario authoring Sprint 5 | 🔵 OPEN                                                          |
| LLM prompt injection (Coach + DDS)                    | Tech §8 + SP-7       | M×H | Security Champion | Threat model trước launch v1.4        | 🔵 OPEN                                                          |
| Visual regression chưa có → release vỡ UI             | SM R9 + UX/QA §9     | M×M | QA                | Sprint 2 — 5 page × 3 breakpoint      | ✅ MITIGATED — S2 done                                           |
| Postgres không tune index → SRS chậm >10k user        | SM R8                | M×M | Senior BE         | Sprint 2 index tuning + k6 load test  | ✅ MITIGATED — S2 done                                           |

---

## 6. North-Star Metrics & Guardrails

### OKR Q3 2026 (PO §5)

| O                                 | KR                                   | Baseline | Target        |
| --------------------------------- | ------------------------------------ | -------- | ------------- |
| O1 — "Training system" perception | 70% premium check Readiness ≥3×/tuần | 0%       | 70%           |
| O2 — Long-term retention via SRS  | DAU/MAU                              | ~22%     | ≥35%          |
| O3 — Squad as retention engine    | Squad 30d retention vs solo          | 1.0x     | ≥1.5x         |
| O4 — Predictor validity           | Corr(Score≥80, actual pass)          | n/a      | r≥0.75, n≥200 |
| O5 — Conversion uplift            | Free→Premium 30d                     | 4%       | ≥7%           |

### Guardrails (không được vi phạm)

| Guardrail                          | Threshold                | Owner              |
| ---------------------------------- | ------------------------ | ------------------ |
| API p95 latency                    | <400ms (excl. LLM)       | Tech Lead          |
| Question bank accuracy post-review | ≥98%                     | PO + Reviewer Lead |
| LLM cost / premium user / tháng    | <$1.20                   | Platform           |
| Crash-free session                 | >99.5%                   | QA                 |
| Test coverage                      | ≥80%, không giảm >1%     | QA                 |
| Sprint goal hit rate               | ≥80%                     | SM                 |
| Lead time story start→done         | ≤6 ngày                  | SM                 |
| Escaped defects                    | ≤2/sprint                | QA                 |
| Lighthouse perf                    | ≥85 (app), ≥95 (landing) | UX/QA              |
| Lighthouse a11y                    | ≥95 mọi page             | UX/QA              |

---

## 7. Action Items

### Hoàn thành sau Sprint 1–2 ✅

#### PO (deadline 2026-05-05)

- [x] Xác nhận velocity assumption 40 SP/sprint ✅
- [x] Approve release plan v1.1→v2.0 ✅
- [ ] Chốt D1–D6 ở §4 — **còn mở**, cần quyết định trước Sprint 3 planning
- [ ] Identify 200-user beta cohort cho Pass Predictor — **còn mở**, target Sprint 4

#### Scrum Master (deadline 2026-05-02) ✅

- [x] Publish DoR/DoD vào `/docs/team-planning/` ✅
- [x] Working agreement ký commit (`docs/working-agreement.md`) ✅
- [x] On-call rotation setup (`docs/oncall.md`) ✅
- [ ] Setup Linear project + sprint board — **còn mở**
- [ ] Schedule ceremonies — **còn mở**
- [ ] Setup `#certgym-daily` + 4 channel khác — **còn mở**

#### Tech Lead (deadline 2026-05-15)

- [x] Viết RFC-004 (BullMQ) draft → **Done**, ADR committed (`docs/adr/001-bullmq-decision.md`) ✅
- [x] Run SP-2 (BullMQ + Nest pattern) + SP-6 (strict TS pilot) spike ✅
- [ ] Viết RFC-001 (AttemptEvent) full draft — **Sprint 3 target**
- [ ] Viết RFC-009 (TS strict migration) draft — **In progress** (pilot done for `services/` + `auth/`)
- [ ] Run SP-1 (event ingestion shape) spike — **Sprint 3**

#### UX/QA Lead (deadline 2026-05-10)

- [x] Setup Playwright visual regression baseline cho 5 page critical ✅ (Sprint 2)
- [ ] Confirm Editorial + Dark luxury direction với PO + designer — **Sprint 3**
- [ ] Tokens spec (oklch palette) commit vào `src/styles/tokens.css` — **Sprint 3**
- [ ] A11y audit baseline (axe-core CI gate) — **Sprint 3** (US-306)

### Sprint 3 — Next Actions (deadline 2026-05-14)

- [ ] **Tech Lead**: RFC-001 (AttemptEvent) full draft approved
- [ ] **BE**: US-301 AttemptEvent schema + ingestion endpoint
- [ ] **FE**: US-303 Mastery dashboard v1
- [ ] **FE + BE**: US-304 Streak tracking timezone edge case
- [ ] **FE + UX**: US-305 Exam engine doc + pair tour (bus factor mitigation)
- [ ] **FE + UX**: US-306 A11y audit + fix top-10 issues
- [x] **BE + PO**: US-307 Pass Predictor feature spike (SP-4)

---

## 8. Liên kết tài liệu nguồn

- **Vision**: [docs/vision.md](../vision.md)
- **Architecture hiện tại**: [docs/01-architecture.md](../01-architecture.md)
- **Data model**: [docs/02-data_model.md](../02-data_model.md)
- **API design**: [docs/03-api_design.md](../03-api_design.md)
- **Frontend**: [docs/04-frontend.md](../04-frontend.md)
- **Security**: [docs/06-security.md](../06-security.md)
- **Schema**: [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma)
- **CLAUDE.md** (project rules): [CLAUDE.md](../../CLAUDE.md)

---

> **Tài liệu sống** — review cuối mỗi quý, cập nhật theo sprint review + retro action items.
> **Ownership**: SM duy trì cấu trúc, PO duy trì backlog, Tech Lead duy trì RFC list, UX/QA duy trì design system + test gate.
