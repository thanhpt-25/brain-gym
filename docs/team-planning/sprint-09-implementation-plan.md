# Sprint 9 — "Knowledge Graph & Mastery — v2.0 Kickoff" Implementation Plan

- **Version target:** v2.0.0-alpha (first sprint of the v2.0 "Knowledge Graph & Mastery" theme, Sprints 9–12)
- **Capacity:** ~46 SP committed (stretch — see risk note). Delivered velocity reference: Sprint 8 shipped 28 SP of a 46 SP plan.
- **Window:** 2026-05-26 → 2026-06-06 (2 tuần)
- **Status as of 2026-05-23:** Sprint 8 đóng (v1.5.0 — AI Coach 1-1 chat GA, burnout detection, LLM cost panel, coach analytics, Exam Day Protocol). US-019 và US-021 (vốn nằm trong backlog v2.0) **đã ship ở S8**. Backlog v2.0 còn lại: **US-017 (Cross-Cert Knowledge Graph, 13)**, **US-018 (Dynamic Difficulty Scaling, 8)**, **US-020 (Peer Review Challenge, 8)**, **US-022 (Benchmark vs top 10%, 5)**. **RFC-007 (pgvector) vẫn ở trạng thái "Proposed" — chưa có extension, chưa có `QuestionEmbedding`, chưa có IVFFlat index.** pgvector là nền móng (unblock US-017 + US-018), nên là rủi ro lớn nhất sprint này.
- **Sprint goal:** Mở màn v2.0 — đặt nền **pgvector + embedding pipeline** (RFC-007) rồi build trên nó: **Cross-Cert Knowledge Graph** (vendor × domain overlap), **Dynamic Difficulty Scaling** (LLM rewrite distractor, có audit + rollback), **Peer Review Challenge** (squad vote explanation), và quick-win **Benchmark vs top 10%**.

> ⚠️ **Scope risk (đọc trước):** Tổng 4 story = 34 SP, cộng RFC-007 foundation (~5 SP) + cross-cutting (~7 SP) ≈ 46 SP. Đây là **stretch commit** theo yêu cầu lấy cả 4 story v2.0. Velocity thực S8 = 28 SP. Descope ladder ở §2d được pre-approve để bảo vệ Lane A (Knowledge Graph foundation) — đó là deliverable không-thể-trượt vì 3 sprint sau (S10–S12) phụ thuộc.

Source artefacts:

- [sprint-08-implementation-plan.md](./sprint-08-implementation-plan.md) — AI Coach GA + v1.4 close-out
- [SPRINT_08_SUMMARY.md](../../SPRINT_08_SUMMARY.md) — S8 deliverables (28 SP)
- [01-product-owner.md §3 LATER](./01-product-owner.md) — US-017/018/020/022 backlog + AC mẫu US-017 (E7)
- [03-tech-lead.md §3–4](./03-tech-lead.md) — RFC-007 (pgvector + dedup), RFC-010 (DDS spec), RFC-012 (LLM cost/quota), schema-changes plan (`QuestionEmbedding`, `QuestionVariant`)
- `prisma/schema.prisma` — `Question` (L299), `Choice` (L352), `Comment` (L466), `Vote` (L483), `ReadinessScore` (L1060), `LlmUsageEvent` (L1080), `Organization`/SQUAD subtype (L740), `Certification`/`Domain` (L256/285)
- `src/ai-question-bank/`, `src/insights/`, `src/squads/`, `src/comments/`, `src/analytics/`, `src/training/coach/`

---

## 1. Sprint Goal & Demo

**Goal Hit Criteria:**

- **pgvector live (RFC-007):** Extension bật qua raw SQL migration; `QuestionEmbedding(question_id, model_id, embedding vector(1536))`; backfill worker embed toàn bộ active questions qua BullMQ; semantic dedup hook trong AI gen flow (cosine ≥ 0.92 → flag duplicate). IVFFlat index tạo sau khi ≥ ngưỡng rows.
- **Cross-Cert Knowledge Graph (US-017):** User pass cert A → mở Knowledge Graph → thấy graph vendor × domain với **% overlap** sang các cert khác (vd "AWS VPC ↔ Azure VNet 70%"); drill-down 1 node hiển thị "skip-able" vs "must-learn" topics; chọn cert đích → sinh study plan tối ưu (giảm 30–50% effort estimate).
- **Dynamic Difficulty Scaling (US-018):** Khi user mastery cao trên 1 question, hệ thống đề xuất LLM rewrite distractor (harden) → lưu `QuestionVariant` với diff + reason; mọi rewrite có **audit trail + rollback**; rewrite chỉ áp dụng sau review hoặc auto-gate theo flag cohort. Không vỡ correctness (đáp án đúng giữ nguyên).
- **Peer Review Challenge (US-020):** Squad member submit explanation cho 1 question → các member khác vote → explanation top hiển thị + tác giả nhận điểm reputation/badge. Tái dụng `Comment`/`Vote`/`Organization(SQUAD)`.
- **Benchmark vs top 10% (US-022):** User xem readiness/accuracy của mình so với **percentile top 10% candidate đã pass** cùng cert (anonymized cohort). Tái dụng `ReadinessScore` + `ExamAttempt`.
- **Quality gates:** coverage ≥80% module mới; axe-core ≥95 trên KG view + Peer Review + Benchmark; pgvector query p95 < ngưỡng spike SP-3; LLM cost (embedding + DDS) ghi `LlmUsageEvent` + trong quota.

**Demo script (Thu, end of S9):**

1. **pgvector dedup:** AI gen 1 câu gần-trùng câu đã có → banner "có thể trùng (cosine 0.94)" + link câu gốc.
2. **Knowledge Graph:** Khoa đã pass AWS SAA → mở Graph → thấy overlap sang Azure (node % overlap); click node "Networking" → "skip-able: VPC basics / must-learn: NSG, Azure Firewall"; chọn AZ-104 → study plan rút gọn.
3. **Dynamic Difficulty:** Linh mastery cao trên 1 câu IAM → hệ đề xuất hardened variant → reviewer xem diff → approve → rollback thử nghiệm 1 phát để chứng minh audit.
4. **Peer Review:** Mai trong squad submit explanation → 3 member vote → top explanation lên đầu + badge "Top Explainer".
5. **Benchmark:** Linh xem "readiness 78 — top 10% cohort ở 88; accuracy domain Security của bạn 64% vs cohort 81%".

---

## 2. Story Breakdown (~46 SP)

### 2a. Lane A — Knowledge Graph foundation + US-017 (18 SP) — **không-thể-trượt**

| ID      | Title                                                                                            | SP  | Owner              | Depends                  |
| ------- | ------------------------------------------------------------------------------------------------ | --- | ------------------ | ------------------------ |
| US-807  | RFC-007 pgvector setup — extension + `QuestionEmbedding` + backfill worker + semantic dedup hook | 5   | AI Lead + Platform | RFC-004 (BullMQ — đã có) |
| US-017a | Cross-Cert Graph — overlap data model + compute job (vendor × domain cosine aggregate)           | 5   | Senior BE + ML     | US-807                   |
| US-017b | Cross-Cert Graph FE — graph view + node drill-down (skip-able/must-learn)                        | 5   | Senior FE + FE     | US-017a                  |
| US-017c | Study-plan generation từ cert đích (effort reduction estimate)                                   | 3   | BE + FE            | US-017a                  |

### 2b. Lane B — Mastery & Community (16 SP)

| ID     | Title                                                                                                         | SP  | Owner             | Depends              |
| ------ | ------------------------------------------------------------------------------------------------------------- | --- | ----------------- | -------------------- |
| US-018 | Dynamic Difficulty Scaling — `QuestionVariant` schema + LLM rewrite distractor + audit/rollback + review gate | 8   | AI Lead + BE + FE | US-807, RFC-010      |
| US-020 | Peer Review Challenge — submit explanation + squad vote + reputation/badge                                    | 8   | BE + FE           | Squads, Comment/Vote |

### 2c. Lane C — Quick win + cross-cutting (12 SP)

| ID     | Title                                                                                                                             | SP  | Owner                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------- |
| US-022 | Benchmark vs top 10% cohort — percentile compute + FE panel                                                                       | 5   | BE + FE              |
| US-815 | RFC-012 cost/quota extend cho EMBEDDING + DDS feature + Grafana panel                                                             | 2   | Platform             |
| US-816 | Privacy/ethics: benchmark + peer-review anonymization, DDS rollback policy doc                                                    | 2   | Tech Lead + Security |
| US-817 | Strict-TS allow-list (`ai-question-bank/embedding`, `analytics/benchmark`) + axe + visual regression (KG, Peer Review, Benchmark) | 2   | Senior FE + QA       |
| US-818 | Bug pool + post-release watch + Sprint 10 prep                                                                                    | 1   | Whole team + SM      |

**Total: 18 (Lane A) + 16 (Lane B) + 12 (Lane C) = 46 SP.**

### 2d. Descope ladder (pre-approved — bảo vệ Lane A)

Nếu Day 6 burndown trailing, descope theo thứ tự:

1. **US-017c study-plan defer → S10** (−3 SP) — graph view + drill-down vẫn ship, chỉ thiếu auto study-plan.
2. **US-018 thu về "propose-only"** (−4 SP) — sinh `QuestionVariant` + audit + diff viewer, **không** auto-apply; rewrite áp dụng tay sang S10.
3. **US-020 thu về "submit + vote, no badge/reputation"** (−2 SP) — reputation engine defer S11.
4. **US-022 thu về readiness-percentile-only** (−2 SP) — bỏ domain-level breakdown.
5. **Cuối cùng (chỉ nếu pgvector spike fail):** US-017a chuyển sang **tag-overlap heuristic (Jaccard trên `QuestionTag`/`Domain`)** thay vì cosine embedding — graph vẫn demo được, độ chính xác thấp hơn; RFC-007 tiếp tục S10. (−0 SP nhưng giảm rủi ro chặn toàn lane.)

---

## 3. Decision Gates

### Gate 1: pgvector viability (By Day 2) — **gate chặn cả Lane A/B**

| Điều kiện                                                               | Kết quả                                                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Extension bật + embed 1 batch + cosine top-k query p95 < 150ms          | ✅ GO — embedding-based overlap (US-017a) + dedup + DDS similarity                  |
| pgvector chạy nhưng latency/RAM xấu ở data hiện có                      | ⚠️ CAUTION — IVFFlat tuning, giảm dim hoặc batch nhỏ; theo dõi Day 4                |
| Extension không bật được trên Postgres image hiện tại / blocker hạ tầng | ❌ FALLBACK — kích hoạt descope ladder #5 (tag-overlap heuristic); RFC-007 sang S10 |

**Owner:** AI Lead + Platform. Ghi trong ADR-021. (Tham chiếu spike SP-3 trong 03-tech-lead.md.)

### Gate 2: DDS correctness & safety (By Day 6)

| Điều kiện                                                     | Kết quả                                             |
| ------------------------------------------------------------- | --------------------------------------------------- |
| Rewrite giữ đúng đáp án 100% (n≥30) + diff/rollback hoạt động | ✅ GO — auto-apply sau review gate, ramp cohort nhỏ |
| Rewrite đôi khi đổi nghĩa/đáp án                              | ⚠️ CAUTION — propose-only, bắt buộc human review    |
| Rewrite làm hỏng correctness > 10%                            | ❌ HOLD — DDS propose-only, tune prompt S10         |

**Owner:** AI Lead + Reviewer. Ghi ADR-022.

### Gate 3: Benchmark & Peer-Review privacy (By Day 8)

| Điều kiện                                                                    | Kết quả                                         |
| ---------------------------------------------------------------------------- | ----------------------------------------------- |
| Cohort ≥ ngưỡng k-anonymity (vd n≥20 passed candidates) + không lộ danh tính | ✅ GO — bật benchmark cho all PREMIUM           |
| Cohort nhỏ < ngưỡng cho 1 cert                                               | ⚠️ ẩn benchmark cert đó, hiện "chưa đủ dữ liệu" |
| Có rủi ro re-identification                                                  | ❌ HOLD — chỉ hiện percentile thô, ẩn breakdown |

**Owner:** Tech Lead + Security. Tie vào US-816.

---

## 4. Day-by-Day Plan

### Week 1 (2026-05-26 → 05-30)

| Ngày    | Focus                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mon** | Planning 90'. US-807: raw SQL migration bật `vector` extension + `QuestionEmbedding`; embedding job skeleton (BullMQ). **Spike pgvector** (SP-3). US-022: percentile query design.   |
| **Tue** | **Gate 1 (pgvector viability).** US-807: backfill worker embed active questions; cosine top-k POC. US-018: `QuestionVariant` migration draft + DDS prompt skeleton.                  |
| **Wed** | US-807: semantic dedup hook trong AI gen flow. US-017a: overlap compute job (vendor × domain cosine aggregate → cache). US-020: schema reuse plan (Comment/Vote + reputation field). |
| **Thu** | US-017a: overlap API endpoint. US-017b: graph view FE skeleton (vendor × domain). US-018: LLM rewrite distractor + diff/audit (`QuestionVariant`). US-022: benchmark BE endpoint.    |
| **Fri** | US-017b: node drill-down (skip-able/must-learn). US-020: submit explanation + vote BE+FE. US-815 cost/quota hook (EMBEDDING+DDS). US-817 strict-TS allow-list.                       |

### Week 2 (2026-06-02 → 06-06)

| Ngày    | Focus                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mon** | **Gate 2 (DDS correctness/safety).** US-017c: study-plan generation. US-018: review gate + rollback UI. US-020: reputation/badge ("Top Explainer").                             |
| **Tue** | US-022 FE panel (readiness + domain percentile vs cohort). US-815 Grafana panel live. US-816 privacy/ethics doc (benchmark k-anonymity, peer-review anon, DDS rollback policy). |
| **Wed** | **Gate 3 (privacy).** Code freeze. axe + visual + E2E green (KG, DDS review, Peer Review, Benchmark). Demo dry-run với PO. US-818 bug sweep.                                    |
| **Thu** | **Release v2.0.0-alpha** — gate flags theo cohort. Sprint Review + Retro. Sprint 10 prep seeded.                                                                                |
| **Fri** | Post-release watch buffer; hotfix window.                                                                                                                                       |

---

## 5. Story Implementation Notes

### US-807 — RFC-007 pgvector setup (5 SP, AI Lead + Platform)

Acceptance:

- Raw SQL migration: `CREATE EXTENSION IF NOT EXISTS vector;` + thêm cột `embedding vector(1536)` vào bảng `question_embeddings`. Prisma model `QuestionEmbedding(questionId @id, modelId, updatedAt)` + raw column (Prisma chưa hỗ trợ vector native — theo migration strategy §4 03-tech-lead.md).
- Embedding worker (BullMQ): backfill active `Question` (title + description + choices) qua `text-embedding-3-small` (1536 dim); ghi `LlmUsageEvent` feature=`EMBEDDING`.
- IVFFlat index tạo **sau** khi ≥ ngưỡng rows (RFC-007 note); trước đó dùng exact scan.
- Semantic dedup hook: trong AI gen flow, query cosine top-k; nếu ≥ 0.92 → flag candidate duplicate (warn, không block).
- Reversible: migration down drop column + extension guard.

Files: `prisma/migrations/<ts>_pgvector_question_embeddings/migration.sql` (raw), `prisma/schema.prisma` (`QuestionEmbedding`), `src/ai-question-bank/embedding/embedding.processor.ts` (mới), `src/ai-question-bank/embedding/embedding.service.ts` (mới), `test/ai-question-bank/embedding.spec.ts`.

### US-017a — Cross-Cert Graph overlap compute (5 SP, Senior BE + ML)

Acceptance:

- Job tính overlap vendor × domain: cosine aggregate giữa question-embedding clusters của (cert A domain) ↔ (cert B domain); kết quả cache vào model mới `CertOverlap(certA, certB, domainA, domainB, overlapPct, computedAt)`.
- Endpoint `GET /knowledge-graph/overlap?certId=` trả graph nodes (vendor×domain) + edges (%overlap).
- Fallback (descope #5): nếu pgvector fail, dùng Jaccard trên `QuestionTag`/`Domain` chung.

Files: `prisma/schema.prisma` (`CertOverlap`), `src/knowledge-graph/knowledge-graph.module.ts` (mới), `src/knowledge-graph/overlap.processor.ts`, `src/knowledge-graph/knowledge-graph.controller.ts`, `test/knowledge-graph/overlap.spec.ts`.

### US-017b — Knowledge Graph FE (5 SP, Senior FE + FE)

Acceptance:

- Trang graph (frontend repo, root) hiển thị vendor × domain nodes + edges %overlap; click node → drill-down "skip-able" (overlap cao) vs "must-learn" (overlap thấp / no coverage).
- Lazy-load + `<PageTransition>`; axe ≥95; reduced-motion respect; responsive 4 breakpoints.

Files (frontend repo): `src/pages/KnowledgeGraph.tsx`, `src/components/knowledge-graph/GraphCanvas.tsx`, `src/components/knowledge-graph/NodeDrillDown.tsx`, `src/services/knowledgeGraph.ts`, `src/App.tsx` (route `/knowledge-graph`).

### US-017c — Study-plan generation (3 SP, BE + FE)

Acceptance:

- Given user chọn cert đích, tính study plan tối ưu: skip topic overlap cao, ưu tiên must-learn; trả effort-reduction estimate (30–50%).
- Defer-able sang S10 (descope #1).

Files: `src/knowledge-graph/study-plan.service.ts`, FE `src/components/knowledge-graph/StudyPlan.tsx`.

### US-018 — Dynamic Difficulty Scaling (8 SP, AI Lead + BE + FE)

Acceptance (RFC-010):

- Khi user mastery cao trên question (dùng `mastery` module / accuracy history), đề xuất LLM rewrite distractor (harden/soften) → `QuestionVariant(questionId, variantOf, rewriteJobId, reason: DDS_HARDEN|DDS_SOFTEN|MANUAL, diff Json)`.
- **Correctness invariant:** đáp án đúng không đổi; chỉ distractor rewrite. Validate output schema.
- Audit trail + rollback: reviewer xem diff, approve/reject; rollback về variant trước. Ghi `LlmUsageEvent` feature=`DDS`.
- Review gate (flag cohort) — auto-apply chỉ khi Gate 2 GO; mặc định propose-only.

Files: `prisma/schema.prisma` (`QuestionVariant`), `src/ai-question-bank/dds/dds.service.ts` (mới), `src/ai-question-bank/dds/dds.processor.ts`, `src/ai-question-bank/dds/dds.controller.ts`, FE diff viewer `src/components/admin/DdsVariantReview.tsx`, `test/ai-question-bank/dds.spec.ts`.

### US-020 — Peer Review Challenge (8 SP, BE + FE)

Acceptance:

- Squad member submit explanation cho 1 question (tái dụng `Comment` hoặc model mới `PeerExplanation`); member khác vote (tái dụng `Vote` với `targetType=EXPLANATION`).
- Top explanation hiển thị đầu; tác giả nhận reputation point + badge "Top Explainer" (tái dụng `Badge`/`BadgeAward`).
- Chỉ trong scope squad (`Organization` kind=SQUAD); RLS/permission theo squad membership.

Files: `prisma/schema.prisma` (`PeerExplanation` + `VoteTargetType` extend), `src/squads/peer-review/peer-review.service.ts` (mới), `src/squads/peer-review/peer-review.controller.ts`, FE `src/components/squads/PeerReviewChallenge.tsx`, `test/squads/peer-review.spec.ts`.

### US-022 — Benchmark vs top 10% (5 SP, BE + FE)

Acceptance:

- Compute percentile cohort: với mỗi cert, lấy `ReadinessScore` + `ExamAttempt` của candidate **đã pass** (anonymized), tính p90 (top 10%); so user vs cohort ở readiness + domain accuracy.
- k-anonymity guard (Gate 3): cohort < ngưỡng → "chưa đủ dữ liệu".
- FE panel trên Dashboard hoặc trang cert.

Files: `src/analytics/benchmark/benchmark.service.ts` (mới), `src/analytics/benchmark/benchmark.controller.ts`, FE `src/components/dashboard/BenchmarkPanel.tsx`, `test/analytics/benchmark.spec.ts`.

### US-815 — Cost/quota extend (2 SP, Platform)

- Extend RFC-012 layer: feature `EMBEDDING` + `DDS` vào `LlmUsageEvent`; Grafana panel cost theo feature.

### US-816 — Privacy/ethics (2 SP, Tech Lead + Security)

- Doc: benchmark k-anonymity threshold; peer-review anonymization scope; DDS rollback policy + audit retention. ADR-022 (DDS), ADR-023 (benchmark privacy).

### US-817 — Strict-TS + a11y + visual (2 SP, Senior FE + QA)

- `ai-question-bank/embedding`, `ai-question-bank/dds`, `analytics/benchmark`, `knowledge-graph` vào RFC-009 allow-list. axe ≥95 + visual baselines (KG view, DDS review, Peer Review, Benchmark) ở 4 breakpoints.

### US-818 — Bug pool + Sprint 10 prep (1 SP, whole team + SM)

- Monitor v2.0.0-alpha: embedding cost, dedup precision, DDS correctness, benchmark cohort coverage. Sprint 10 candidates: hoàn thiện US-017c study-plan (nếu defer), DDS auto-apply ramp, peer-review reputation engine.

---

## 6. Cross-cutting Engineering Tasks

| Task                                                          | Owner              | Deadline  |
| ------------------------------------------------------------- | ------------------ | --------- |
| pgvector raw SQL migration + extension trên Postgres image    | Platform           | Day 1     |
| ADR-021: pgvector viability go/no-go (Gate 1)                 | AI Lead            | EOD Day 2 |
| RFC-007 doc finalize (status Proposed → Accepted)             | AI Lead            | Day 3     |
| RFC-010 DDS doc finalize + ADR-022 (Gate 2)                   | AI Lead + Reviewer | Day 6     |
| RFC-012 cost/quota EMBEDDING+DDS + Grafana panel              | Platform           | Day 7     |
| ADR-023: benchmark privacy / k-anonymity (Gate 3)             | Security           | Day 8     |
| `docs/team-planning/sprint-09-execution-log.md` daily updates | SM                 | Daily     |

---

## 7. Definition of Done (Sprint 9 bổ sung)

Ngoài DoD chuẩn:

- **Zero `describe.skip` gate** (kế thừa) — CI fail nếu phát hiện.
- **pgvector gate:** không build US-017a embedding-overlap nếu Gate 1 chưa GO (fallback heuristic được phép demo).
- **DDS correctness gate:** không auto-apply rewrite nếu correctness < 100% trong test (n≥30); propose-only fallback.
- **Privacy gate:** không bật benchmark/peer-review nếu cohort < k-anonymity threshold.
- **LLM cost gate:** embedding + DDS phải ghi `LlmUsageEvent` + Grafana panel trước ramp.
- **Reversible migrations:** `QuestionEmbedding`, `QuestionVariant`, `CertOverlap`, `PeerExplanation` đều có down-migration.

---

## 8. Risks & Mitigations

| Risk                                                        | P×I     | Mitigation                                                                       | Owner              |
| ----------------------------------------------------------- | ------- | -------------------------------------------------------------------------------- | ------------------ |
| pgvector không bật được trên Postgres image → chặn Lane A/B | M×H     | Gate 1 Day 2 sớm; fallback tag-overlap heuristic (descope #5); image audit Day 1 | Platform + AI Lead |
| Scope 46 SP > velocity thực (28 SP S8) → burndown trailing  | **H×H** | Descope ladder §2d pre-approved; Lane A bảo vệ tuyệt đối; cắt từ Lane C trước    | SM                 |
| DDS rewrite làm hỏng correctness đáp án                     | M×H     | Correctness invariant + Gate 2; propose-only default; human review gate          | AI Lead + Reviewer |
| Embedding cost backfill toàn bộ question bank vượt budget   | M×M     | Batch + rate-limit; `LlmUsageEvent` tracking; backfill incremental               | Platform           |
| Benchmark re-identification (cohort nhỏ)                    | M×M     | k-anonymity threshold; Gate 3; ẩn breakdown khi thiếu data                       | Security           |
| KG overlap compute chậm/nặng trên data lớn                  | L×M     | Cache `CertOverlap`; compute async job; IVFFlat sau ngưỡng rows                  | Senior BE          |
| US-017 (13 SP) là story lớn nhất → trượt một phần           | M×M     | Split a/b/c; US-017c defer-able (descope #1)                                     | SM                 |

---

## 9. Capacity & Allocation

| Role               | Capacity (SP) | Allocated                                                      |
| ------------------ | ------------- | -------------------------------------------------------------- |
| AI Lead            | 9             | US-807 (3 share), US-017a ML (2 share), US-018 (4 share)       |
| Senior BE          | 9             | US-017a (5), US-018 BE (2), US-020 BE (2 share)                |
| BE                 | 8             | US-017c BE (1), US-020 BE (3), US-022 BE (3), buffer (1)       |
| Senior FE          | 8             | US-017b (5), US-817 (2), polish (1)                            |
| FE                 | 8             | US-017b (share 2), US-018 FE (2), US-020 FE (2), US-022 FE (2) |
| Platform           | 5             | US-807 (2), US-815 (2), pgvector infra (1)                     |
| Security/Tech Lead | 2             | US-816 + Gate 3                                                |
| QA                 | 2             | US-817 a11y + visual + E2E                                     |
| SM + PO            | 1             | US-818 + execution log                                         |
| **Total**          | **~46**       | (stretch — xem descope ladder §2d)                             |

---

## 10. Exit Checklist

### Lane A — Knowledge Graph foundation + US-017

- [ ] `vector` extension bật; `QuestionEmbedding` + raw vector column migrated (reversible).
- [ ] Embedding backfill worker chạy; active questions embedded; `LlmUsageEvent` feature=EMBEDDING.
- [ ] Semantic dedup hook flag near-duplicate (cosine ≥ 0.92) trong AI gen flow.
- [ ] `CertOverlap` compute job + `GET /knowledge-graph/overlap` endpoint.
- [ ] KG FE: graph view + node drill-down (skip-able/must-learn); axe ≥95.
- [ ] US-017c study-plan generation (hoặc ghi defer S10 nếu descope #1).
- [ ] ADR-021 (pgvector go/no-go) committed.

### Lane B — Mastery & Community

- [ ] `QuestionVariant` schema + migration (reversible); DDS rewrite giữ correctness invariant.
- [ ] DDS audit trail + diff viewer + rollback; review gate; ADR-022.
- [ ] Peer Review: submit explanation + squad vote + top explanation + badge "Top Explainer".

### Lane C — Quick win + cross-cutting

- [ ] Benchmark percentile compute + FE panel; k-anonymity guard; ADR-023.
- [ ] RFC-012 cost/quota EMBEDDING+DDS; Grafana panel.
- [ ] Strict-TS allow-list cập nhật; axe + visual regression green (KG, DDS, Peer Review, Benchmark).
- [ ] RFC-007 + RFC-010 docs finalized (Proposed → Accepted).
- [ ] Privacy docs: benchmark k-anonymity + peer-review anon + DDS rollback policy.
- [ ] Zero `describe.skip`; coverage ≥80% module mới.
- [ ] v2.0.0-alpha tagged (cohort-gated); release notes published.
- [ ] Sprint Retro held; Sprint 10 prep seeded (study-plan, DDS auto-apply ramp, reputation engine).
