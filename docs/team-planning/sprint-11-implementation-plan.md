# Sprint 11 — "v2.0 RC — Auto-Apply GA Ramp, Anti-Gaming & Observability Close-out" Implementation Plan

- **Version target:** v2.0.0-rc (sprint thứ 3 trong theme v2.0 "Knowledge Graph & Mastery", Sprints 9–12). S12 = v2.0 GA.
- **Capacity:** ~34 SP committed. Velocity reference: S8 = 28 SP, S9 = 46 SP (stretch, alpha), S10 = 32 SP (hardening, đúng commit). S11 giữ mức trung bình + 3 SP QA dành riêng (theo retro action item S10).
- **Window:** 2026-06-23 → 2026-07-04 (2 tuần)
- **Status as of 2026-05-23 (planning):** S10 ship v2.0.0-beta cohort-gated. Cả 4 story feature v2.0 (KG, DDS, Reputation, Benchmark) đã ở mức beta; AI Coach 1-1 chat (US-019, SSE streaming) và Exam Day Protocol (US-021) đã build từ v1.4/S9. **Không còn story v2.0 net-new.** S11 đóng nốt khoảng cách GA-readiness được seed ở §S11 Prep + Retro của execution log S10.
- **Sprint goal:** Đưa v2.0 beta → **release candidate**: (1) **DDS auto-apply ra khỏi shadow mode** sau khi Gate 2 xác nhận ≥30 clean approvals trên production; (2) **reputation anti-gaming** (phát hiện vote-velocity bất thường); (3) **KG real-time recompute** khi question đổi domain/tag + **tạo IVFFlat index** khi đủ rows; (4) **đóng nợ quality-gate** đã defer 2 sprint liên tiếp (axe + visual baselines cho component S10, Grafana panels). Không thêm scope feature mới — RC là về độ tin cậy, an toàn và quan sát được.

> ℹ️ **Tại sao là RC, không phải feature mới:** Theme v2.0 đã feature-complete sau S10. S11–S12 chỉ còn việc làm cho hệ đủ tin cậy để GA: flip an toàn các flag đang shadow, chống lạm dụng reputation, đảm bảo graph luôn tươi, và bật đủ observability để vận hành. Mọi lane dưới đây ánh xạ 1-1 vào **S11 Prep candidates** và **Retro action items** trong [sprint-10-execution-log.md](./sprint-10-execution-log.md).

Source artefacts:

- [sprint-10-execution-log.md](./sprint-10-execution-log.md) — §"S11 Prep — Candidates" + §"Retro Notes / Action items for S11" là nguồn scope chính.
- [sprint-10-implementation-plan.md](./sprint-10-implementation-plan.md) — Gate 1/2/3 definitions; lane structure tham chiếu.
- [00-master-roadmap.md](./00-master-roadmap.md) — v2.0 theme (S9–12), guardrails §6, risk heatmap §5.
- `backend/src/ai-question-bank/dds/dds.service.ts` — `evaluateAutoApply` (L260), `tryAutoApply` (L311) đang **shadow mode default** (`DDS_SHADOW_MODE !== 'false'`, L316); kill-switch `DDS_AUTO_APPLY_ENABLED` (L262); threshold đọc runtime (L53).
- `backend/src/squads/peer-review/peer-review.service.ts` — `vote` (L88) + `accrueReputation` (L201); idempotent + cấm self-vote đã có, **chưa có** velocity/anomaly guard.
- `backend/src/knowledge-graph/knowledge-graph.service.ts` — `enqueueOverlapCompute` (L67) chạy tay qua endpoint; **chưa** tự trigger khi question đổi domain/tag; IVFFlat index vẫn defer (Gate 1 S10).
- `backend/src/exams/exam-day.controller.ts` — checklist (L100) hardcoded; ứng viên tích hợp study-plan scheduling.
- `e2e/` — `a11y.spec.ts`, `visual-regression.spec.ts` đã có; **thiếu** baseline cho 4 component S10 (DDS auto-apply admin, reputation leaderboard, saved study plan, benchmark domain breakdown).

---

## 1. Sprint Goal & Demo

**Goal Hit Criteria:**

- **DDS auto-apply GA ramp (US-1101):** Sau khi Gate 2 xác nhận n≥30 clean approvals + 0 correctness violation trên production beta → flip `DDS_SHADOW_MODE=false` cho cohort `beta-rewriters`; auto-apply **thực thi** (không chỉ log); kill-switch tức thì; thêm **canary guard** (auto-pause flip nếu rollback-rate > ngưỡng trong cửa sổ trượt). Nếu Gate 2 chưa đủ data → giữ shadow, descope #1.
- **Reputation anti-gaming (US-1102):** Phát hiện vote-velocity bất thường (burst vote trong cửa sổ ngắn, vote-ring trong squad nhỏ); điểm từ vote nghi ngờ bị **hold/không tính** + flag cho admin; không double-count, không phạt oan vote hợp lệ. ADR cập nhật ngưỡng.
- **KG real-time recompute (US-1103):** Khi một question đổi `domainId`/tags → enqueue overlap recompute cho cert liên quan (debounced, tái dụng `overlap-compute` queue); graph không stale > ngưỡng. **IVFFlat index** tạo `CONCURRENTLY` nếu `question_embeddings` đạt ngưỡng rows (Gate 1 re-check); reversible.
- **Study-plan scheduling integration (US-1104):** Saved study plan (US-1002) hiển thị trong exam-prep flow + sinh review schedule (tái dụng SRS/`ReviewSchedule`); mở plan trong context "đang luyện cert X".
- **Quality-gate close-out (US-1105):** axe ≥95 + visual baselines (4 breakpoints: 320/768/1024/1440) cho **4 component S10**; zero `describe.skip`; coverage ≥80% code mới.
- **Observability close-out (US-1106):** Grafana panels live: DDS auto-apply rate + rollback rate, reputation accrual + anomaly-flag volume, IVFFlat/overlap query p95, LLM cost theo feature. Alert rule cho rollback-rate canary.
- **Guardrails giữ nguyên:** API p95 <400ms (excl. LLM), crash-free >99.5%, coverage không giảm >1%, Lighthouse a11y ≥95.

**Demo script (Thu, end of S11):**

1. **Auto-apply GA:** Admin xem dashboard Gate 2 = 32 clean approvals, 0 violation → bấm "Promote cohort to live" → `DDS_SHADOW_MODE=false`. Linh trả đúng câu IAM mastery cao → hệ propose hardened variant → **auto-apply thật** sau gate → audit "auto-applied (live)". Giả lập 1 rollback đẩy rollback-rate vượt ngưỡng → canary **auto-pause** về shadow + alert Grafana.
2. **Anti-gaming:** 5 tài khoản squad vote chéo 1 explanation trong 10 giây → hệ flag "suspicious vote burst", điểm hold, leaderboard không nhảy; admin thấy flag + có nút clear.
3. **KG real-time:** Admin sửa `domainId` của 1 question AWS SAA → overlap recompute tự enqueue (job id) → graph cập nhật < ngưỡng, không cần bấm tay. IVFFlat index đã tạo (nếu Gate 1 GO) → p95 overlap query giảm.
4. **Study-plan scheduling:** Khoa mở exam-prep cho AZ-104 → thấy saved plan "skip 3 domain, tập trung Security" + review schedule sinh từ plan.
5. **Observability:** Mở Grafana → 4 panel live; alert rule rollback-rate đang armed.

---

## 2. Story Breakdown (~34 SP)

### 2a. Lane A — DDS auto-apply GA ramp (8 SP) — **headline RC feature**

| ID      | Title                                                                                | SP  | Owner             | Depends               |
| ------- | ------------------------------------------------------------------------------------ | --- | ----------------- | --------------------- |
| US-1101 | Flip shadow→live cohort + canary auto-pause (rollback-rate guard) + admin promote UI | 5   | AI Lead + BE + FE | US-1003 (S10), Gate 2 |
| US-1107 | Gate 2 production data collection harness (đếm clean approvals, surface dashboard)   | 3   | AI Lead + BE      | US-1003 (S10)         |

### 2b. Lane B — Reputation anti-gaming (5 SP)

| ID      | Title                                                                           | SP  | Owner   | Depends       |
| ------- | ------------------------------------------------------------------------------- | --- | ------- | ------------- |
| US-1102 | Vote-velocity / vote-ring anomaly detection + point-hold + admin flag review UI | 5   | BE + FE | US-1005 (S10) |

### 2c. Lane C — KG freshness & perf (8 SP)

| ID      | Title                                                                             | SP  | Owner                | Depends            |
| ------- | --------------------------------------------------------------------------------- | --- | -------------------- | ------------------ |
| US-1103 | Real-time overlap recompute on question domain/tag change (debounced enqueue)     | 3   | BE                   | US-1001 (S10)      |
| US-1108 | IVFFlat index creation (Gate 1 re-check) + recall measurement vs exact scan       | 3   | Senior BE + Platform | US-807, US-1001    |
| US-1104 | Study-plan scheduling integration (exam-prep surface + ReviewSchedule generation) | 2   | BE + FE              | US-1002 (S10), SRS |

### 2d. Lane D — Quality & observability close-out (8 SP)

| ID      | Title                                                                                         | SP  | Owner          | Depends             |
| ------- | --------------------------------------------------------------------------------------------- | --- | -------------- | ------------------- |
| US-1105 | axe ≥95 + visual baselines (4 bp) cho 4 component S10; zero `describe.skip`; coverage ≥80%    | 3   | QA + Senior FE | US-1002/05/06 (S10) |
| US-1106 | Grafana panels live (auto-apply rate, rollback canary, reputation accrual+flags, IVFFlat p95) | 3   | Platform       | US-1012 (S10 defer) |
| US-1109 | Rollback-rate alert rule + runbook entry (canary auto-pause response)                         | 2   | Platform + SM  | US-1101, US-1106    |

### 2e. Lane E — Cross-cutting (~5 SP)

| ID      | Title                                                                                         | SP  | Owner           |
| ------- | --------------------------------------------------------------------------------------------- | --- | --------------- |
| US-1110 | RFC/ADR: ADR-026 (auto-apply GA + canary policy), ADR-027 (reputation anti-gaming thresholds) | 1   | Tech Lead       |
| US-1111 | Worktree init: thêm `prisma generate` step (S10 retro action item)                            | 1   | Platform        |
| US-1112 | Bug pool + v2.0.0-rc release (cohort-gated) + S12 GA prep (full-cohort ramp checklist)        | 2   | Whole team + SM |
| US-1113 | Prompt-injection regression sweep cho DDS + Coach (SP-7 threat model close-out trước GA)      | 1   | Security        |

### 2f. Descope ladder (pre-approved — bảo vệ Lane D close-out)

Nếu Day 6 burndown trailing, descope theo thứ tự:

1. **US-1108 IVFFlat defer lại S12** (−3 SP) — giữ exact scan nếu rows vẫn dưới ngưỡng; không chặn RC.
2. **US-1101 giữ shadow mode** (−5 SP→2 SP) — nếu Gate 2 chưa đủ 30 clean approvals trên prod, chỉ ship canary harness + promote UI ở trạng thái "armed, not flipped"; flip ở S12.
3. **US-1104 study-plan scheduling defer → S12** (−2 SP) — saved plan vẫn xem được, chỉ chưa sinh ReviewSchedule.
4. **Cuối cùng:** US-1102 thu về "detect + log only" (−2 SP) — flag anomaly + log, chưa hold điểm; hold tay ở S12.

---

## 3. Quality Gates

### Gate 1 (re-check): IVFFlat viability (By Day 2)

**Decision: ⚠️ NO GO (2026-05-24)** — `question_embeddings` row count = 0 (threshold: ≥10k)

- Migration created (reversible) and ready for activation when row count reaches 10k
- Keeping exact scan for now
- Deferring index creation to S12 or when production data is available

| Điều kiện                                                   | Kết quả                                             |
| ----------------------------------------------------------- | --------------------------------------------------- |
| `question_embeddings` rows ≥ ngưỡng (≥10k) + build < budget | ✅ GO — tạo IVFFlat `CONCURRENTLY`, đo recall + p95 |
| Rows vẫn < ngưỡng                                           | ⚠️ **CURRENT STATE** — giữ exact scan; defer S12    |
| Build lock/timeout trên prod image                          | ❌ HOLD — exact scan, điều tra ops                  |

**Owner:** Platform + Senior BE.
**Migration:** `20260624000001_sprint11_ivfflat_index/migration.sql` (conditional, awaits data)

### Gate 2 (decision): DDS auto-apply shadow→live (By Day 5)

| Điều kiện                                                                             | Kết quả                                                        |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Production beta: n≥30 clean approvals, **0** correctness violation, rollback verified | ✅ GO — flip `DDS_SHADOW_MODE=false` cohort beta, canary armed |
| 1 ≤ violation < ngưỡng hoặc <30 approvals                                             | ⚠️ giữ shadow (descope #2); promote UI "armed not flipped"     |
| Violation > ngưỡng hoặc rollback lỗi                                                  | ❌ HOLD — propose-only, tune prompt, S12                       |

**Owner:** AI Lead + Reviewer. Ghi ADR-026.

### Gate 3 (safety): Anti-gaming false-positive rate (By Day 8)

| Điều kiện                                                                | Kết quả                                        |
| ------------------------------------------------------------------------ | ---------------------------------------------- |
| Anomaly detector: precision đủ cao trên replay data, false-positive thấp | ✅ GO — bật point-hold + admin flag            |
| False-positive cao (phạt oan vote hợp lệ)                                | ⚠️ detect + log only (descope #4), tune ngưỡng |
| Detector miss vote-ring rõ ràng trong test                               | ❌ HOLD — refine heuristic trước khi hold điểm |

**Owner:** BE + Tech Lead. Ghi ADR-027.

---

## 4. Day-by-Day Plan

### Week 1 (2026-06-23 → 06-27)

| Ngày    | Focus                                                                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mon** | Planning 90'. US-1111 worktree `prisma generate` (unblock cả team ngay). US-1107 Gate 2 harness skeleton. US-1103 question-edit hook design. US-1108 row-count check.         |
| **Tue** | **Gate 1 (IVFFlat re-check).** US-1108 tạo index nếu GO + recall measure. US-1102 anomaly detector design (velocity window + ring heuristic). US-1106 Grafana panel skeleton. |
| **Wed** | US-1101 canary auto-pause logic (rollback-rate sliding window) + flip mechanism. US-1103 debounced enqueue on edit. US-1105 axe pass cho 4 component.                         |
| **Thu** | US-1102 point-hold + admin flag endpoint. US-1104 ReviewSchedule generation từ saved plan. US-1105 visual baselines capture (4 bp).                                           |
| **Fri** | **Gate 2 (auto-apply data review).** US-1107 dashboard surface clean-approval count. US-1101 admin promote UI. US-1106 panels wiring. US-1113 prompt-injection sweep start.   |

### Week 2 (2026-06-30 → 07-04)

| Ngày    | Focus                                                                                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mon** | US-1101 flip cohort beta (nếu Gate 2 GO) + canary armed. US-1102 anomaly FE flag-review UI. US-1104 exam-prep surface saved plan.                                          |
| **Tue** | **Gate 3 (anti-gaming FP rate).** US-1109 rollback-rate alert rule + runbook. US-1106 panels live. US-1110 ADR-026/027.                                                    |
| **Wed** | Code freeze. axe + visual + E2E green (auto-apply promote, anomaly flag review, KG real-time, study-plan scheduling). US-1113 sweep xong. Demo dry-run. US-1112 bug sweep. |
| **Thu** | **Release v2.0.0-rc** — cohort-gated. Sprint Review + Retro. S12 GA prep seeded (full-cohort ramp checklist).                                                              |
| **Fri** | Post-release watch buffer; hotfix window; canary monitoring.                                                                                                               |

---

## 5. Story Implementation Notes

### US-1101 — Auto-apply flip + canary (5 SP, AI Lead + BE + FE)

Acceptance:

- Flip path: khi Gate 2 GO, `DDS_SHADOW_MODE=false` cho cohort `beta-rewriters`; `tryAutoApply` ([dds.service.ts:311](backend/src/ai-question-bank/dds/dds.service.ts)) **thực thi** apply (đã có executor từ S10), audit `reviewNote = 'auto-applied (live, cohort=…)'`.
- **Canary auto-pause:** theo dõi rollback-rate trong cửa sổ trượt (vd N apply gần nhất); vượt ngưỡng → tự set shadow mode lại + emit alert (US-1109). Idempotent, không đụng variant đã apply.
- Kill-switch `DDS_AUTO_APPLY_ENABLED` ([dds.service.ts:262](backend/src/ai-question-bank/dds/dds.service.ts)) vẫn override mọi thứ.
- FE admin: nút "Promote cohort to live" (disabled tới khi Gate 2 GO), hiển thị canary state (armed/paused), recent auto-applied + rollback.

Files: `backend/src/ai-question-bank/dds/dds.service.ts` (canary logic), `backend/src/ai-question-bank/dds/dds.controller.ts` (promote/canary-state endpoints), `src/components/admin/DdsAutoApplyPanel.tsx` (promote + canary UI), `backend/test/ai-question-bank/dds-canary.spec.ts`.

### US-1107 — Gate 2 data harness (3 SP, AI Lead + BE)

Acceptance:

- Đếm clean approvals per cohort (approval không kèm correctness violation, không bị rollback sau đó); surface qua endpoint `GET /admin/dds/auto-apply/readiness` (count, violations, lastRollbackAt).
- Dashboard FE hiển thị tiến độ tới ngưỡng (vd 32/30) để hỗ trợ quyết định Gate 2.

Files: `backend/src/ai-question-bank/dds/dds.service.ts` (`getAutoApplyReadiness`), controller, `src/components/admin/DdsAutoApplyPanel.tsx`, test.

### US-1102 — Reputation anti-gaming (5 SP, BE + FE)

Acceptance:

- Anomaly heuristic trong/quanh `vote` ([peer-review.service.ts:88](backend/src/squads/peer-review/peer-review.service.ts)): (a) vote-velocity — quá nhiều vote tới cùng explanation/author trong cửa sổ ngắn; (b) vote-ring — nhóm nhỏ vote chéo lẫn nhau bất thường. Self-vote đã cấm sẵn (giữ nguyên).
- Vote nghi ngờ: điểm **không accrue** (hold) trong `accrueReputation` ([peer-review.service.ts:201](backend/src/squads/peer-review/peer-review.service.ts)); tạo `ReputationFlag` record cho admin review; vote hợp lệ không bị ảnh hưởng (Gate 3 FP rate).
- FE: admin flag-review list (clear / confirm); leaderboard không phản ánh điểm đang hold.

Files: `backend/prisma/schema.prisma` (`ReputationFlag`), `backend/src/squads/peer-review/peer-review.service.ts` (detector + hold), controller (flag review endpoints), `src/components/admin/ReputationFlagReview.tsx` (mới), `backend/test/squads/anti-gaming.spec.ts`.

### US-1103 — KG real-time recompute (3 SP, BE)

Acceptance:

- Hook khi question đổi `domainId`/tags → `enqueueOverlapCompute` ([knowledge-graph.service.ts:67](backend/src/knowledge-graph/knowledge-graph.service.ts)) cho cert chứa question đó, **debounced** (gộp nhiều edit trong cửa sổ ngắn thành 1 job). Tái dụng `overlap-compute` queue (S10).
- Cache invalidation: bump `computedAt`; tránh enqueue trùng (dedupe theo certId trong cửa sổ).

Files: `backend/src/ai-question-bank/*` (question update path → emit event/call enqueue), `backend/src/knowledge-graph/knowledge-graph.service.ts` (debounce/dedupe), `backend/test/knowledge-graph/realtime-recompute.spec.ts`.

### US-1108 — IVFFlat index (3 SP, Senior BE + Platform)

Acceptance:

- Re-check Gate 1 row threshold. Nếu GO: migration `CREATE INDEX CONCURRENTLY question_embeddings_ivfflat_idx ON question_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);` — reversible.
- Đo recall vs exact scan (tune `lists`/`probes` nếu recall thấp) + p95 trước/sau, log vào US-1106 panel.

Files: `backend/prisma/migrations/<ts>_ivfflat_index/migration.sql`, recall measurement script/test.

### US-1104 — Study-plan scheduling (2 SP, BE + FE)

Acceptance:

- Saved `StudyPlan` (US-1002) surface trong exam-prep flow của target cert; sinh `ReviewSchedule` entries cho must-learn topics (tái dụng SRS), skip-able topics không lên lịch.
- FE: exam-prep view hiển thị plan + lịch review sinh ra.

Files: `backend/src/knowledge-graph/knowledge-graph.service.ts` (`scheduleFromPlan`), controller, FE exam-prep + `src/components/knowledge-graph/StudyPlan.tsx`, test.

### US-1105 — Quality-gate close-out (3 SP, QA + Senior FE)

- axe ≥95 + visual baselines (320/768/1024/1440) cho `DdsAutoApplyPanel`, `SquadReputationLeaderboard`, study-plan saved view, benchmark domain breakdown panel (component S10 chưa có baseline). Zero `describe.skip`. Coverage ≥80% module mới S11.

Files: `e2e/a11y.spec.ts`, `e2e/visual-regression.spec.ts` (+ snapshots), spec mới cho component S10.

### US-1106 — Grafana panels (3 SP, Platform)

- Panels: DDS auto-apply rate + rollback rate (canary), reputation accrual volume + anomaly-flag volume, IVFFlat/overlap query p95, LLM cost theo feature (extend RFC-012). Đây là phần defer từ US-1012 (S10) — Platform sync access Day 1 (retro action).

### US-1109 — Rollback-rate alert + runbook (2 SP, Platform + SM)

- Alert rule khi rollback-rate vượt ngưỡng canary; runbook entry mô tả phản ứng (canary auto-pause đã tự xảy ra; on-call xác nhận + điều tra). Cập nhật `docs/oncall.md`.

### US-1110 — RFC/ADR (1 SP, Tech Lead)

- ADR-026: DDS auto-apply GA + canary policy (ngưỡng rollback-rate, cửa sổ, hành vi auto-pause). ADR-027: reputation anti-gaming thresholds (velocity window, ring detection, FP tolerance).

### US-1111 — Worktree init `prisma generate` (1 SP, Platform)

- Thêm `prisma generate` vào worktree init script (S10 retro: enum regen liên tục gây fail test trong worktree).

### US-1112 — Bug pool + v2.0.0-rc + S12 GA prep (2 SP, whole team + SM)

- Tag v2.0.0-rc (cohort-gated). S12 GA prep: full-cohort ramp checklist (mở auto-apply cohort, tắt cohort-gate cho 4 feature, load test GA, final a11y/perf audit). Execution log.

### US-1113 — Prompt-injection sweep (1 SP, Security)

- Regression sweep DDS variant prompt + Coach chat ([coach-safety.service.ts](backend/src/training/coach/coach-safety.service.ts)) trước GA — đóng SP-7 threat model (risk heatmap §5 "LLM prompt injection").

---

## 6. Cross-cutting Engineering Tasks

| Task                                               | Owner         | Deadline |
| -------------------------------------------------- | ------------- | -------- |
| Worktree `prisma generate` step (unblock team)     | Platform      | Day 1    |
| Platform ↔ AI Lead Grafana access sync (S10 retro) | Platform      | Day 1    |
| Gate 1 IVFFlat row-threshold re-check              | Platform + BE | Day 2    |
| Gate 2 production clean-approval data review       | AI Lead       | Day 5    |
| ADR-026 auto-apply GA + canary policy              | Tech Lead     | Day 7    |
| ADR-027 anti-gaming thresholds                     | Tech Lead     | Day 8    |
| Rollback-rate alert rule + runbook                 | Platform + SM | Day 8    |

---

## 7. Capacity & Allocation

| Role               | Capacity (SP) | Allocated                                             |
| ------------------ | ------------- | ----------------------------------------------------- |
| AI Lead            | 6             | US-1101 (3 share), US-1107 (3)                        |
| Senior BE          | 5             | US-1108 (3), US-1103 (2 share)                        |
| BE                 | 6             | US-1102 (3 share), US-1103 (1), US-1104 BE (2)        |
| Senior FE          | 4             | US-1101 FE (2), US-1105 (2 share)                     |
| FE                 | 5             | US-1102 FE (2), US-1104 FE (1), US-1105 (2 share)     |
| Platform           | 5             | US-1106 (3), US-1108 ops (1), US-1109 (1)             |
| Security/Tech Lead | 2             | US-1110 (1), US-1113 (1)                              |
| QA                 | 3             | US-1105 axe + visual + E2E (dành riêng, retro action) |
| SM + PO            | 0 (overhead)  | US-1112 + execution log                               |
| **Total**          | **~34**       | (descope ladder §2f bảo vệ Lane D)                    |

---

## 8. Risks

| Rủi ro                                                             | P×I | Mitigation                                                                             | Owner    |
| ------------------------------------------------------------------ | --- | -------------------------------------------------------------------------------------- | -------- |
| Gate 2 chưa đủ 30 clean approvals trên prod → không flip được      | M×M | Descope #2 giữ shadow; promote UI "armed not flipped"; flip S12; harness đếm sớm Day 1 | AI Lead  |
| Auto-apply live làm hỏng correctness ngoài cohort kiểm soát        | M×H | Canary auto-pause + kill-switch + correctness invariant; flip cohort nhỏ trước         | AI Lead  |
| Anti-gaming phạt oan vote hợp lệ (false positive)                  | M×M | Gate 3 FP rate; descope #4 detect+log only; tune trên replay data                      | BE       |
| IVFFlat rows vẫn dưới ngưỡng (lần 2)                               | M×L | Descope #1 giữ exact scan; không chặn RC; backfill embedding theo dõi                  | Platform |
| Grafana access lại block (lặp lại S10)                             | L×M | Sync Day 1 (retro action cứng); panel design đã sẵn từ S10                             | Platform |
| QA capacity bị hút sang feature, quality gate lại defer (3 sprint) | M×H | 3 SP QA **dành riêng** US-1105, không reallocate; SM bảo vệ                            | SM + QA  |
| Real-time recompute enqueue storm khi bulk-edit question           | M×M | Debounce + dedupe theo certId; rate-limit job enqueue                                  | BE       |

---

## 9. Exit Checklist

### Lane A — DDS auto-apply GA ramp

- [ ] Gate 2 data harness: clean-approval count surface; quyết định flip ghi nhận.
- [ ] Flip shadow→live cohort beta (hoặc ghi defer S12 nếu Gate 2 chưa GO) — kill-switch verified.
- [ ] Canary auto-pause khi rollback-rate vượt ngưỡng; ADR-026.

### Lane B — Reputation anti-gaming

- [ ] Anomaly detector (velocity + ring); điểm hold cho vote nghi ngờ; idempotent, FP rate trong ngưỡng (Gate 3).
- [ ] `ReputationFlag` + admin flag-review UI; leaderboard loại điểm hold. ADR-027.

### Lane C — KG freshness & perf

- [ ] Question domain/tag change → debounced overlap recompute enqueue; dedupe.
- [ ] IVFFlat index tạo (hoặc defer S12, Gate 1) — recall đo + reversible.
- [ ] Study-plan surface trong exam-prep + ReviewSchedule generation.

### Lane D — Quality & observability

- [ ] axe ≥95 + visual baselines 4 bp cho 4 component S10; zero `describe.skip`; coverage ≥80% mới.
- [ ] Grafana panels live (auto-apply rate, rollback canary, reputation accrual+flags, IVFFlat p95).
- [ ] Rollback-rate alert rule + runbook entry.

### Cross-cutting

- [ ] ADR-026 + ADR-027 committed.
- [ ] Worktree `prisma generate` step added.
- [ ] Prompt-injection sweep DDS + Coach passed (SP-7 close-out).
- [ ] v2.0.0-rc tagged (cohort-gated); release notes published.
- [ ] Sprint Retro held; S12 GA prep seeded (full-cohort ramp checklist, GA load test, final a11y/perf audit).
