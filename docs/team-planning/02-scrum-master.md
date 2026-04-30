# 02 — Scrum Master Playbook (CertGym)

> Tài liệu vận hành Scrum cho CertGym (Brain Gym). Bám theo roadmap PO: Q2 Foundation + Question SRS, Q3 Pass Predictor + Behavioral Insights, Q4 Training Squads + Cross-Cert Graph.
> Mục tiêu: tạo nhịp giao hàng đều đặn, bảo vệ chất lượng, kiểm soát tech debt và risk thay vì chạy theo feature mù quáng.

---

## 1. Team composition & capacity

### 1.1 Team

| Role                   | Số người | FTE     | Ghi chú                                                   |
| ---------------------- | -------- | ------- | --------------------------------------------------------- |
| Product Owner          | 1        | 1.0     | Sở hữu backlog, ưu tiên, gặp khách hàng/khoa thi          |
| Scrum Master           | 1        | 0.7     | Kiêm 0.3 FTE engineering hỗ trợ tooling/CI                |
| Frontend Engineer      | 2        | 2.0     | 1 senior (exam engine, design system), 1 mid (org, admin) |
| Backend Engineer       | 2        | 2.0     | 1 senior (auth, multi-tenant, AI), 1 mid (SRS, analytics) |
| QA Engineer            | 1        | 1.0     | Sở hữu Playwright suite, test plan, automation gate       |
| UX/Product Designer    | 1        | 0.5     | Part-time, drive design system + research                 |
| **Total dev capacity** | **6**    | **5.5** | Không tính PO                                             |

### 1.2 Velocity giả định

- Sprint 2 tuần, **6 dev** ~ 5.5 FTE.
- Mỗi FTE tải ~8 SP/sprint (sau khi trừ ceremonies, support).
- **Velocity nền: 40 SP/sprint** cho 3 sprint đầu, kỳ vọng tăng lên 48–55 SP từ sprint 4 khi team đã ổn định.

### 1.3 Capacity split

| Loại công việc                                      | % capacity | SP/sprint (≈40) |
| --------------------------------------------------- | ---------- | --------------- |
| Feature mới (roadmap PO)                            | 60%        | 24              |
| Tech debt + platform (TS strict, Playwright, queue) | 20%        | 8               |
| Bug + production support                            | 10%        | 4               |
| Spike + R&D (AI, SRS algo)                          | 10%        | 4               |

Giữ tỉ lệ này tối thiểu 2 quý đầu — không cho feature ăn quá 70% nếu không sẽ vỡ Q4.

---

## 2. Sprint cadence & ceremonies

- **Sprint length:** 2 tuần (Thứ Tư → Thứ Ba kế tiếp). Tránh kết thúc thứ Sáu để retro/demo không bị nuốt vào weekend.
- **Sprint Planning:** Thứ Tư, 90 phút. Phần 1: WHAT (PO trình goal + top stories). Phần 2: HOW (team commit, chia task).
- **Daily Standup:** 9:30, 15 phút, async-first qua Slack `#certgym-daily` + sync 2 buổi/tuần (T2, T5) cho blocker.
- **Backlog Refinement:** Thứ Năm tuần lẻ, 60 phút. Story phải đạt DoR trước planning kế tiếp.
- **Sprint Review/Demo:** Thứ Ba cuối sprint, 45 phút. Demo build thật trên staging, mời 1–2 stakeholder/giáo viên.
- **Retrospective:** Ngay sau Review, 45 phút. Format luân phiên: Start/Stop/Continue, 4Ls, Sailboat.
- **Tech Sync:** Thứ Sáu hàng tuần, 30 phút (FE+BE+QA), bàn architecture, schema, test strategy.

### Working agreement (5 quy ước)

1. **PR ≤ 400 LOC**, mở review trong 4 giờ. Quá 400 LOC phải có lý do và thông báo SM.
2. **Mọi PR phải xanh CI** (lint, type, unit, e2e smoke) trước khi merge. Không bypass `--no-verify`.
3. **Story chỉ Done khi demo được trên staging** (không phải máy local).
4. **Blocker > 4 giờ phải gọi SM**. Không ai được im lặng kẹt cả ngày.
5. **Tech debt thấy là log ngay** vào `/tech-debt` board (không sửa lén trong PR feature lớn).

---

## 3. Definition of Ready (DoR) & Definition of Done (DoD)

### DoR — Story sẵn sàng vào sprint

- [ ] User story format `As a … I want … so that …` + business value rõ ràng.
- [ ] Acceptance criteria viết theo Gherkin (Given/When/Then), tối thiểu 3 case (happy + edge + error).
- [ ] UX có wireframe hoặc design Figma link (với story FE).
- [ ] Phụ thuộc kỹ thuật (API, schema, env var) đã được note + xác nhận khả thi.
- [ ] Estimate Story Points (Fibonacci, max 8 — story > 8 phải split).
- [ ] QA đã review test approach (manual vs e2e vs unit).
- [ ] Không có open question với PO; nếu có spike thì spike đã xong.

### DoD — Story xong

- [ ] Code merge vào `main`, qua review từ ≥1 dev khác (FE story → FE reviewer + BE nếu chạm API).
- [ ] Unit test đạt coverage ≥80% file mới; không giảm coverage tổng quá 1%.
- [ ] Integration/e2e test cho flow chính (Playwright cho FE, Jest e2e cho BE).
- [ ] Lint + type check sạch (cả khi `noImplicitAny:false` vẫn không introduce `any` mới ở module mới).
- [ ] A11y check: keyboard nav, contrast AA, focus visible (story FE).
- [ ] Performance check: không regress LCP/INP > 10% trên Lighthouse staging.
- [ ] Telemetry/log đủ để debug production (ít nhất 1 audit log + 1 metric).
- [ ] Docs/CHANGELOG cập nhật; nếu chạm DB → migration + rollback plan.
- [ ] Demo được trên staging và PO đã sign-off.
- [ ] Security check: không hardcode secret, input validate ở boundary, role/guard cho route nhạy cảm.

---

## 4. Risk Register

| #   | Risk                                                                      | P   | I   | Mitigation                                                                                                                       | Owner          |
| --- | ------------------------------------------------------------------------- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| R1  | TypeScript loose (`noImplicitAny:false`) gây runtime bug khó trace        | H   | H   | Spike Sprint 1: bật strict cho `src/services/` + `backend/src/auth/`; thêm gate "no new `any`" trong ESLint                      | Senior FE      |
| R2  | E2E flaky (commit f732275, e63ade8) chặn pipeline                         | H   | H   | Sprint 1 lập "test isolation pattern", cô lập DB seed/teardown, stabilize 5 flow critical, set quarantine cho test flaky > 3 lần | QA Lead        |
| R3  | Chưa có job queue → AI generation block request HTTP                      | M   | H   | Spike Sprint 2 (BullMQ trên Redis có sẵn), Sprint 4 đưa vào production cho AI question gen                                       | Senior BE      |
| R4  | Multi-tenant leak data giữa org                                           | L   | H   | Guard tests bắt buộc cho mọi route `/org/:slug`, security review bắt buộc với mọi PR chạm `org.store` hoặc `OrgGuard`            | Senior BE + SM |
| R5  | Người: 1 senior nghỉ → bus factor = 1 cho exam engine                     | M   | H   | Pair programming bắt buộc cho exam engine, doc hóa kiến trúc trong `/docs/exam-engine.md` trước Sprint 3                         | SM             |
| R6  | LLM provider thay đổi giá/quota (OpenAI/Anthropic) ảnh hưởng AI Generator | M   | M   | Adapter pattern (đã có), benchmark 2 provider mỗi quý, cap cost trong env config                                                 | Senior BE      |
| R7  | Q3 "Pass Predictor" thiếu data thật → model overfit                       | M   | H   | Sprint 3 bắt đầu collect feature event (anonymized), lùi launch nếu < 1k user attempt                                            | PO + BE        |
| R8  | Postgres không tune index → SRS chậm khi user > 10k                       | M   | M   | Sprint 2 thêm index `due_at`, `user_id+card_id`, k6 load test 10k user mock                                                      | Senior BE      |
| R9  | Visual regression chưa có → release làm vỡ UI                             | M   | M   | Sprint 2 thêm Playwright screenshot (320/768/1440) cho 5 page critical                                                           | QA + FE        |
| R10 | Chưa CSP nonce-based → XSS risk khi mở rộng AI render markdown            | L   | H   | Sprint 1 thêm CSP nonce + sanitize markdown (DOMPurify), security review                                                         | Senior FE      |

P/I: L=Low, M=Medium, H=High. Review register cuối mỗi sprint trong Retro.

---

## 5. Sprint Plan Sprint 1–3

### Sprint 1 — "Stabilize the gym" (capacity 40 SP)

- **Goal:** Pipeline xanh ổn định, foundation cho SRS, không introduce regression.
- **Key stories:**
  - US-101 Fix E2E isolation + quarantine flaky (8 SP) — QA + BE
  - US-102 Bật strict TS cho `src/services/*` + `backend/src/auth/*` (5 SP) — FE + BE
  - US-103 SRS schema + migration (review/repetition/easeFactor/dueAt) (8 SP) — BE
  - US-104 Flashcard review API (POST /flashcards/:id/review) (5 SP) — BE
  - US-105 CSP nonce + DOMPurify cho AI render (5 SP) — FE
  - US-106 Spike: BullMQ feasibility (3 SP) — BE
  - US-107 Bug pool + support (4 SP) — Team
  - US-108 Onboard Lighthouse CI baseline (2 SP) — FE + SM
- **Dependencies:** Redis sẵn, không cần infra mới.
- **Demo plan:** Show CI pipeline xanh 5 lần liên tiếp, demo flashcard review API qua Postman, show Lighthouse baseline.

### Sprint 2 — "First learner loop" (capacity 42 SP)

- **Goal:** Học viên review được flashcard với SRS thực sự, có thấy due card hôm nay.
- **Key stories:**
  - US-201 Flashcard review UI (queue, rating 1–4, animation) (8 SP) — FE
  - US-202 Due-today widget on dashboard (5 SP) — FE
  - US-203 SRS algorithm SM-2 polish + unit test (5 SP) — BE
  - US-204 Index tuning + k6 load test 10k user (5 SP) — BE
  - US-205 Visual regression suite (Playwright screenshot 5 pages × 3 breakpoints) (8 SP) — QA + FE
  - US-206 BullMQ setup + AI gen worker (8 SP) — BE
  - US-207 Tech debt: extract `api.ts` interceptor unit test (3 SP) — FE
- **Dependencies:** Sprint 1 schema + API.
- **Demo plan:** Học viên thật làm 20 flashcard, show due queue cập nhật, show Playwright screenshots diff = 0.

### Sprint 3 — "Insight kickoff" (capacity 44 SP)

- **Goal:** Bắt đầu collect signal cho Pass Predictor; SRS đã production-grade.
- **Key stories:**
  - US-301 Event tracking schema (attempt, review, hint_used, time_spent) (5 SP) — BE
  - US-302 Privacy-aware analytics ingestion endpoint (5 SP) — BE
  - US-303 Mastery dashboard v1 (per-domain progress bars) (8 SP) — FE
  - US-304 Streak tracking polish + edge case (timezone) (5 SP) — FE + BE
  - US-305 Exam engine doc + pair tour (3 SP) — Senior FE + Mid FE
  - US-306 A11y audit + fix top-10 issues (5 SP) — FE + UX
  - US-307 Spike: Pass Predictor feature definition (5 SP) — BE + PO
  - US-308 Bug pool + support (4 SP) — Team
  - US-309 Retro action items thực thi (4 SP) — SM
- **Dependencies:** Sprint 2 SRS production, BullMQ chạy thật.
- **Demo plan:** Show event flow end-to-end (action FE → event BE → dashboard query), show mastery dashboard với data thật, present Pass Predictor feature spec.

---

## 6. Process metrics & cadence

### 6.1 Metrics (review hàng sprint)

| Metric                         | Target            | Cách đo                                  |
| ------------------------------ | ----------------- | ---------------------------------------- |
| Sprint goal hit rate           | ≥ 80%             | Goal đạt vs cam kết                      |
| Velocity stability             | σ ≤ 15%           | StdDev / mean 5 sprint gần nhất          |
| Lead time (story start → done) | ≤ 6 ngày          | Linear/Jira cycle time                   |
| Escaped defects                | ≤ 2/sprint        | Bug production trong 14 ngày sau release |
| PR review turnaround           | ≤ 4h working      | GitHub review latency                    |
| Test coverage trend            | ≥ 80%, không giảm | Vitest + Jest coverage                   |
| Flaky test count               | ≤ 3 quarantined   | Playwright quarantine list               |
| Tech debt ratio                | 20% capacity      | Story point thực tế                      |

### 6.2 Cadence chi tiết tuần

| Day     | Activity                                                                  |
| ------- | ------------------------------------------------------------------------- |
| **Mon** | Async standup + 30' sync blocker; PO/SM 1:1 (15')                         |
| **Tue** | (Tuần cuối sprint) Sprint Review + Retro; (tuần giữa) deep work           |
| **Wed** | (Sprint mới) Planning 90'; pair programming buổi chiều                    |
| **Thu** | Refinement (tuần lẻ) hoặc Design review (tuần chẵn); async standup        |
| **Fri** | Tech Sync 30'; demo nội bộ Friday show-and-tell 30'; metrics review by SM |

---

## 7. Communication plan

### Slack channels

- `#certgym-daily` — async standup, bot reminder 9:00.
- `#certgym-eng` — câu hỏi kỹ thuật FE/BE.
- `#certgym-incidents` — alert + on-call response.
- `#certgym-release` — auto post từ CI khi deploy staging/prod.
- `#certgym-pm` — PO + SM + designer thảo luận roadmap.

### Docs & sources of truth

- **Backlog:** Linear (project `CertGym Q2`).
- **Specs:** `/docs/*.md` (đã có), thêm `/docs/team-planning/` cho process artifact.
- **Decisions:** ADR mới trong `/docs/adr/NNN-title.md` cho mỗi quyết định ảnh hưởng > 1 sprint.
- **Runbook on-call:** `/docs/runbook.md` (cần tạo Sprint 2).

### Async vs sync

- **Async-first:** standup, code review, status update, RFC.
- **Sync chỉ khi:** planning, retro, incident, kiến trúc lớn, conflict cá nhân.
- Quy ước: nếu thread Slack > 10 reply → tạo doc + meeting.

### Stakeholder reporting

- **Hàng tuần (Fri):** SM gửi 1-pager trong `#certgym-pm`: progress, blocker, risk top-3.
- **Cuối sprint:** PO gửi release note + demo recording cho stakeholder ngoài team.
- **Hàng tháng:** Steering review (PO + SM + Tech Lead), 60', report metrics + roadmap drift.

---

## 8. Top 10 process improvements cần ngay (priority)

1. **E2E test isolation pattern** (Sprint 1) — fix root cause flaky thay vì retry.
2. **CI gate đầy đủ** (lint + type + unit + e2e smoke) bắt buộc trước merge.
3. **No-new-`any` ESLint rule** cho module mới — chặn TS debt tăng thêm.
4. **PR template + checklist DoD** trên GitHub — tự đánh dấu trước khi xin review.
5. **Story split rule ≤ 8 SP** — bất kỳ story > 8 phải split trong refinement.
6. **Quarantine flaky test sau 3 lần fail** — không block trunk, log issue tracking.
7. **Visual regression baseline Sprint 2** — Playwright screenshot 5 page critical × 3 breakpoint.
8. **ADR cho mọi quyết định kiến trúc** — tránh tribal knowledge.
9. **On-call rotation tuần** + runbook tối thiểu (deploy, rollback, log access).
10. **Metric dashboard công khai** (Linear + GitHub Actions API) — velocity, lead time, escaped defects view ai cũng đọc được.

---

> Tài liệu sống — review cuối mỗi quý, cập nhật theo retro action item lớn.
