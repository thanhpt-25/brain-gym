# 01 — Product Owner Deliverable: CertGym (Brain Gym)

> Vai trò: Product Owner — Scrum Team CertGym
> Phạm vi: 3 quý tới (Q2 — Q4 2026), từ v1.1 đến v2.0
> Tham chiếu: `docs/vision.md`, `CLAUDE.md`, `backend/prisma/schema.prisma`

---

## 1. Personas

### P1 — Linh, "The First-Try Learner" (28, DevOps Engineer)

- Mục tiêu: pass AWS SAA-C03 trong 6 tuần, không trượt lần nào (đã trượt 1 lần).
- Pain: học lan man, không biết "đủ chưa", lo lắng dồn dập 1 tuần trước thi.
- Hành vi: học 30–60 phút/ngày trên mobile, cuối tuần luyện mock 2 tiếng trên laptop.
- Giá trị mong đợi: biết chính xác "khi nào sẵn sàng" và "phải học gì kế tiếp".

### P2 — Khoa, "The Repeat Certifier" (35, Cloud Architect)

- Mục tiêu: đã có AWS SAP, đang chinh phục Azure + GCP để T-shaped.
- Pain: kiến thức chồng chéo nhưng không biết tận dụng, học lại từ đầu mỗi vendor.
- Hành vi: ưu tiên scenario phức tạp, ghét MCQ ngơ ngẩn, thích "trap question".
- Giá trị mong đợi: knowledge graph cross-cert, scenario simulation, leaderboard chuyên gia.

### P3 — Mai, "The Squad Lead" (32, Tech Lead Mentor)

- Mục tiêu: dẫn dắt 6 junior trong team cùng pass CKAD trong Q3.
- Pain: thiếu công cụ track tiến độ nhóm, mất thời gian tổng hợp tay từng người.
- Hành vi: setup squad 1 lần/tuần, review báo cáo, tag câu khó cho cả nhóm.
- Giá trị mong đợi: squad dashboard, peer-review queue, tag/assign câu hỏi cho member.

### P4 — Hùng, "The Contributor Expert" (40, Principal Engineer)

- Mục tiêu: build reputation, tăng badge "Expert Reviewer", đóng góp 200+ câu chất lượng.
- Pain: tool review nghèo nàn, không thấy impact đóng góp của mình.
- Hành vi: review 10–20 câu/tuần, viết explanation dài, debate trong comment.
- Giá trị mong đợi: reviewer dashboard, audit trail, contribution score, Hall of Fame.

---

## 2. Epic List

| Epic ID | Tên Epic                                       | Business Value                                                                                                           | Success Metric (Q3 target)                                                    |
| ------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **E1**  | Exam Readiness Score (Pass Predictor)          | Moat lớn nhất — mỗi user trả tiền để biết "tôi đã sẵn sàng chưa". Chuyển CertGym từ "question bank" → "training system". | ≥70% premium user check Readiness ≥3 lần/tuần; correlation actual-pass ≥ 0.75 |
| **E2**  | Question-Level SRS (Spaced Repetition cho MCQ) | Tăng retention dài hạn, kéo daily active. Khác biệt với Anki vì tích hợp domain + difficulty.                            | DAU/MAU ≥ 35%; trung bình 25 câu SRS/user/ngày                                |
| **E3**  | Adaptive Weakness Training v2                  | Giảm "waste study", giữ user ở edge-of-competence. Tăng study efficiency.                                                | Time-to-readiness giảm 25% so với baseline; NPS ≥ 50                          |
| **E4**  | Scenario Simulation Engine                     | Differentiator vs Whizlabs/ExamTopics. Kéo giá premium tier.                                                             | ≥40% premium user complete ≥1 scenario/tuần; conversion free→premium +15%     |
| **E5**  | Training Squads (Social Layer)                 | Cohort retention — giảm churn 30 ngày, tăng word-of-mouth B2B (team licenses).                                           | ≥20% active user join squad; squad-mode retention 30d > solo 1.5x             |
| **E6**  | AI Coach 1-1 & Burnout Detection               | Premium upgrade hook. Behavioral insights là moat về data.                                                               | ≥60% premium user nhận ≥1 coach insight/tuần; CSAT ≥ 4.4/5                    |
| **E7**  | Cross-Cert Knowledge Graph                     | Long-term retention — user ở lại sau khi pass cert đầu tiên.                                                             | ≥30% user pass cert 1 → start cert 2 trong 60 ngày                            |
| **E8**  | Time Pressure Training Mode                    | Hoàn thiện "Stamina pillar". Quick win — tận dụng exam engine sẵn có.                                                    | ≥25% user thử mode trong 14 ngày đầu; speed-mode pass rate cải thiện 10%      |

---

## 3. User Stories — Prioritized Backlog

### NOW — Q2 2026 (v1.1 → v1.2, Sprint 1–4)

| ID     | Story                                                                                                     | Priority | SP  | Epic |
| ------ | --------------------------------------------------------------------------------------------------------- | -------- | --- | ---- |
| US-001 | Là Linh, tôi muốn xem **Readiness Score %** trên dashboard, để biết khoảng cách tới ngày thi.             | Must     | 8   | E1   |
| US-002 | Là Linh, tôi muốn click vào Score để xem **breakdown theo domain**, để biết domain nào kéo điểm xuống.    | Must     | 5   | E1   |
| US-003 | Là Linh, tôi muốn câu MCQ đã sai được **lên lịch ôn lại theo SM-2** (1/3/7/21 ngày), để không quên.       | Must     | 13  | E2   |
| US-004 | Là Linh, tôi muốn dashboard có widget **"Due for review today: 24 questions"**, để bắt đầu nhanh.         | Must     | 3   | E2   |
| US-005 | Là Khoa, tôi muốn vào **Time Pressure Mode** (65 câu / 90 phút thay vì 130), để rèn tốc độ.               | Should   | 5   | E8   |
| US-006 | Là Linh, tôi muốn hệ thống **gợi ý topic kế tiếp** dựa trên proficiency thấp nhất, để không phải tự chọn. | Must     | 8   | E3   |
| US-007 | Là Hùng, tôi muốn **flag câu hỏi nghi vấn** với lý do, để reviewer xử lý.                                 | Should   | 3   | E2   |
| US-008 | Là Linh, tôi muốn nhận **email nhắc** "bạn có 24 câu cần ôn", để duy trì streak.                          | Could    | 2   | E2   |

**AC mẫu — US-001 (Readiness Score):**

- _Given_ user đã làm ≥50 câu trong 1 cert, _When_ mở dashboard, _Then_ hiển thị score 0–100 + label (Not Ready / Borderline / Ready / Strong).
- _Given_ score được tính, _When_ user hover info icon, _Then_ show formula breakdown (accuracy × domain coverage × recency × difficulty).
- _Given_ user làm thêm câu mới, _When_ hoàn thành session, _Then_ score recompute trong < 2s.
- _Given_ user có < 50 câu, _When_ mở dashboard, _Then_ show "Need 50+ questions to unlock" + progress bar.

**AC mẫu — US-003 (Question SRS):**

- _Given_ user trả lời sai 1 MCQ, _When_ submit, _Then_ tạo SrsCard với interval = 1 day.
- _Given_ user trả lời lại đúng câu đó, _When_ submit ở review session, _Then_ interval × 2.5 (SM-2 ease factor).
- _Given_ card đến hạn, _When_ user mở "Review Today", _Then_ xuất hiện trong queue, ưu tiên overdue lâu nhất.
- _Given_ user trả lời đúng 5 lần liên tiếp, _When_ ease factor > 2.8, _Then_ card chuyển trạng thái MASTERED.

**AC mẫu — US-006 (Adaptive Topic Suggestion):**

- _Given_ user có proficiency map theo domain, _When_ mở "Practice", _Then_ top 3 gợi ý là domain có proficiency thấp nhất nhưng > 30% (edge-of-competence).
- _Given_ user dismiss gợi ý, _When_ refresh, _Then_ hệ thống đề xuất lựa chọn khác (không lặp).
- _Given_ user accept gợi ý, _When_ hoàn thành 10 câu, _Then_ proficiency được recompute và phản ánh trong dashboard.

---

### NEXT — Q3 2026 (v1.3 → v1.4, Sprint 5–8)

| ID     | Story                                                                                                     | Priority | SP  | Epic |
| ------ | --------------------------------------------------------------------------------------------------------- | -------- | --- | ---- |
| US-009 | Là Mai, tôi muốn **tạo Squad** (5–10 người) với cert mục tiêu + ngày thi, để dẫn dắt nhóm.                | Must     | 8   | E5   |
| US-010 | Là Mai, tôi muốn xem **Squad Dashboard** với progress, weak domain, leaderboard nội bộ, để coach.         | Must     | 13  | E5   |
| US-011 | Là Linh (squad member), tôi muốn nhận **daily challenge từ squad lead**, để học cùng nhóm.                | Should   | 5   | E5   |
| US-012 | Là Khoa, tôi muốn làm **Scenario Simulation** (multi-paragraph + diagram), để rèn architecture reasoning. | Must     | 13  | E4   |
| US-013 | Là Khoa, tôi muốn xem **explanation logic** của scenario (vì sao A đúng, B sai), để học elimination.      | Must     | 5   | E4   |
| US-014 | Là Linh, tôi muốn **AI Coach gửi insight tuần** ("bạn yếu IAM khi đọc > 60 phút"), để cải thiện.          | Should   | 8   | E6   |
| US-015 | Là Linh, tôi muốn hệ thống **phát hiện burnout** (response time variance) và đề xuất 5-min reset.         | Could    | 5   | E6   |
| US-016 | Là Hùng, tôi muốn **Reviewer Queue** với filter (flagged, new, ambiguous), để review hiệu quả.            | Should   | 5   | E2   |

**AC mẫu — US-010 (Squad Dashboard):**

- _Given_ Mai là squad lead, _When_ mở `/org/:slug/squads/:id`, _Then_ hiển thị bảng: member, readiness%, weak domain top-1, last active.
- _Given_ squad có ≥3 member, _When_ mở dashboard, _Then_ show squad-level heatmap domain proficiency.
- _Given_ member chưa active 7+ ngày, _When_ dashboard load, _Then_ highlight đỏ + nút "send nudge".
- _Given_ Mai click member, _When_ drill-down, _Then_ show timeline 30 ngày + suggested coaching action.

**AC mẫu — US-012 (Scenario Simulation):**

- _Given_ scenario có markdown + diagram URL, _When_ user mở, _Then_ render diagram + 4–6 đoạn context.
- _Given_ user chọn answer, _When_ submit, _Then_ show explanation theo từng option (correct/distractor/marketing).
- _Given_ scenario có time limit, _When_ hết giờ, _Then_ auto-submit + hiển thị "thinking time" analytics.
- _Given_ user quay lại, _When_ xem history, _Then_ lưu reasoning trace của user (option đã chọn rồi đổi).

---

### LATER — Q4 2026 (v2.0, Sprint 9–12)

| ID     | Story                                                                                                           | Priority | SP  | Epic |
| ------ | --------------------------------------------------------------------------------------------------------------- | -------- | --- | ---- |
| US-017 | Là Khoa, tôi muốn xem **Cross-Cert Knowledge Graph** ("AWS VPC ↔ Azure VNet 70%"), để chọn cert kế tiếp.        | Should   | 13  | E7   |
| US-018 | Là Linh, tôi muốn **Dynamic Difficulty Scaling** — câu cũ tự động tinh chỉnh distractor, để chống học vẹt.      | Could    | 8   | E3   |
| US-019 | Là Linh, tôi muốn **AI Coach 1-1 chat** trả lời "tại sao đáp án này đúng", để hiểu sâu.                         | Should   | 13  | E6   |
| US-020 | Là Mai, tôi muốn **Peer Review Challenge** — squad member vote explanation tốt nhất, để xây kỹ năng giải thích. | Could    | 8   | E5   |
| US-021 | Là Khoa, tôi muốn **Exam Day Protocol checklist** (24h trước thi), để giảm anxiety.                             | Should   | 3   | E6   |
| US-022 | Là Linh, tôi muốn xem **benchmark vs top 10% candidate đã pass**, để biết mình đứng đâu.                        | Could    | 5   | E1   |

**AC mẫu — US-017 (Cross-Cert Graph):**

- _Given_ user pass AWS SAA, _When_ mở Knowledge Graph, _Then_ hiển thị graph vendor × domain với % overlap.
- _Given_ user click 1 node Azure, _When_ drill-down, _Then_ show "skip-able" topic và "must-learn" topic.
- _Given_ graph có data, _When_ user chọn cert mục tiêu mới, _Then_ generate study plan tối ưu (giảm 30–50% effort).

---

## 4. Release Plan

| Release  | Sprint | Tên (Theme)                      | Scope chính                                                                                                      | Stories                                        | Risk chính                                                 |
| -------- | ------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| **v1.1** | 1–2    | "Quick Wins & Foundations"       | Time Pressure Mode, dashboard Due-for-Review skeleton, flag question, email nhắc. Hoàn thiện exam engine sẵn có. | US-005, US-007, US-008, US-004                 | Tech debt cleanup                                          |
| **v1.2** | 3–4    | "The Pass Predictor" (Core Moat) | Readiness Score v1, Question-level SRS engine, Adaptive Weakness suggest.                                        | US-001, US-002, US-003, US-006                 | Algorithm correctness, cần data validation với cohort thật |
| **v1.3** | 5–6    | "Squads & Scenarios"             | Training Squads + Squad Dashboard. Scenario Simulation (10 scenario/cert pilot).                                 | US-009, US-010, US-011, US-012, US-013         | Content production bottleneck (cần author scenarios)       |
| **v1.4** | 7–8    | "AI Coach Beta"                  | AI weekly insights, burnout detection, reviewer queue.                                                           | US-014, US-015, US-016                         | LLM cost, prompt safety                                    |
| **v2.0** | 9–12   | "Knowledge Graph & Mastery"      | Cross-Cert Graph, Dynamic Difficulty, AI Coach 1-1 chat, Peer Review Challenges, Exam Day Protocol.              | US-017, US-018, US-019, US-020, US-021, US-022 | Scope lớn — cần ưu tiên lại sau v1.4 retrospective         |

**Velocity giả định:** team 5 người (2 FE + 2 BE + 1 FS), velocity ổn định ~30 SP/sprint sau sprint 2.

---

## 5. Top 5 OKRs cho Q3 2026

> Quý trọng tâm: build the moat — Readiness Score + SRS + Squads phải đi vào tay user thật.

| #      | Objective                                                                | Key Result                                                 | Baseline | Target Q3               |
| ------ | ------------------------------------------------------------------------ | ---------------------------------------------------------- | -------- | ----------------------- |
| **O1** | Trở thành "training system" thay vì "question bank" trong nhận thức user | 70% premium user kiểm tra Readiness Score ≥ 3 lần/tuần     | 0%       | 70%                     |
| **O2** | Tăng retention dài hạn nhờ SRS                                           | DAU/MAU ratio                                              | ~22%     | ≥ 35%                   |
| **O3** | Validate Squads là retention engine                                      | 30-day retention của user trong Squad cao hơn user solo    | 1.0x     | ≥ 1.5x                  |
| **O4** | Pass Predictor có giá trị thật, không phải vanity metric                 | Correlation giữa Readiness Score (≥80) và actual pass exam | n/a      | r ≥ 0.75 (n ≥ 200 user) |
| **O5** | Conversion free → premium tăng nhờ Scenario + AI Coach                   | Free → Premium conversion rate (30 ngày)                   | 4%       | ≥ 7%                    |

**Guardrail metrics (không được giảm):**

- p95 API latency < 400ms
- Question bank accuracy (post-review) ≥ 98%
- LLM cost / premium user / tháng < $1.20
- Crash-free session > 99.5%

---

## Phụ lục — Definition of Ready (DoR) & Definition of Done (DoD)

**DoR (story sẵn sàng vào sprint):**

- [ ] Có persona + business value rõ
- [ ] AC viết theo Given/When/Then, ≥ 3 điểm
- [ ] Mock UI (nếu có UI thay đổi) đã reviewed
- [ ] Story points đã estimate (planning poker)
- [ ] Phụ thuộc kỹ thuật đã được flag

**DoD (story xong):**

- [ ] Code merged vào main, CI xanh
- [ ] Unit + integration test, coverage ≥ 80%
- [ ] E2E test cho critical flow (Playwright)
- [ ] Reviewed bởi ≥ 1 dev khác
- [ ] Telemetry/event tracking đã add (cho metric OKR)
- [ ] Update docs (`docs/` hoặc inline)
- [ ] Demo cho PO trong sprint review
