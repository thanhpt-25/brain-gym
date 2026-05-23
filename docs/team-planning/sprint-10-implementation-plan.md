# Sprint 10 — "v2.0 Beta Hardening — Auto-Apply, Reputation & Benchmark Correctness" Implementation Plan

- **Version target:** v2.0.0-beta (second sprint of the v2.0 "Knowledge Graph & Mastery" theme, Sprints 9–12)
- **Capacity:** ~32 SP committed (conservative — hardening sprint). Velocity reference: S8 shipped 28 SP; S9 stretch-committed 46 SP and shipped v2.0.0-alpha (all 4 v2.0 stories at alpha quality).
- **Window:** 2026-06-09 → 2026-06-20 (2 tuần)
- **Status as of 2026-05-23:** S9 (v2.0.0-alpha) đã ship cả 4 story v2.0 (US-017 KG, US-018 DDS, US-020 Peer Review, US-022 Benchmark) + nền pgvector/embedding (US-807). Sprint 10 **không thêm story v2.0 mới** — mục tiêu là đưa alpha → **beta** bằng cách đóng các gap đã seed ở §5 (US-818) của S9 prep và các nợ kỹ thuật phát hiện trong code review.
- **Sprint goal:** Cứng hoá v2.0 lên beta: **DDS auto-apply cohort ramp** (đang propose-only), **reputation engine** thật cho Peer Review (đang chỉ 1 badge nhị phân), **benchmark đúng cohort "đã pass" + breakdown theo domain** (đang benchmark sai cohort), và **KG perf** (IVFFlat index + overlap compute async, đang synchronous nested-loop).

> ℹ️ **Tại sao là hardening, không phải feature mới:** S9 đã over-deliver — kể cả các item descope-ladder dự kiến defer (study-plan generation, peer-review badge) cũng đã land. Phần còn lại của theme v2.0 (S10–S12) là làm cho 4 story đó **đủ tin cậy để GA**: auto-apply an toàn, percentile đúng, query đủ nhanh trên data thật. Bốn lane dưới đây ánh xạ 1-1 vào gap thực trong code (xem §5 file refs).

Source artefacts:

- [sprint-09-implementation-plan.md](./sprint-09-implementation-plan.md) — v2.0.0-alpha plan; §5 US-818 seed S10 candidates; §3 Gates 1–3.
- [00-master-roadmap.md](./00-master-roadmap.md) — v2.0 theme (S9–12), E3/E5/E7/E1 mapping.
- `backend/src/ai-question-bank/dds/dds.service.ts` — propose/approve/reject/rollback (L49–229); **no** auto-apply/cohort/quota guard; raw `fetch` LLM (L242), hardcoded token estimate 600/300 (L300).
- `backend/src/squads/peer-review/peer-review.service.ts` — vote + single `top-explainer` badge upsert (L167); **no** reputation points/score/leaderboard.
- `backend/src/analytics/benchmark/benchmark.service.ts` — cohort = mọi user có `ReadinessScore` (L36), **không** lọc "đã pass"; **no** per-domain breakdown; `getAllBenchmarks` N+1 (L88).
- `backend/src/knowledge-graph/knowledge-graph.service.ts` — `computeOverlaps` synchronous nested-loop O(certs×domA×domB) + per-pair raw SQL (L62–109); study plan không persist (L293).
- `backend/prisma/migrations/20260526000001_pgvector_sprint09/migration.sql` — IVFFlat index **chỉ là comment** (L41–43), chưa tạo.

---

## 1. Sprint Goal & Demo

**Goal Hit Criteria:**

- **DDS auto-apply ramp (US-1003):** Feature flag cohort-gated; sau N≥? clean approvals (0 correctness violation), variant mới của question trong cohort được **auto-apply** sau review gate hoặc auto sau policy; kill-switch tức thì; mọi auto-apply có audit + rollback giữ nguyên (tái dụng `rollback`). Mặc định **shadow mode** nếu Gate 2 không GO.
- **DDS quota guard + shared LLM client (US-1004):** `proposeVariant` **block** khi org/user vượt quota (RFC-012); thay raw `fetch` bằng shared LLM client; token accounting thật (từ response usage) thay vì hardcode 600/300.
- **Reputation engine (US-1005):** `UserReputation` model (điểm tích luỹ theo event: explanation submitted / upvoted / promoted-to-top); tiered badge (Bronze/Silver/Gold Explainer thay 1 badge nhị phân); squad reputation leaderboard FE.
- **Benchmark correctness (US-1006):** Cohort = candidate **đã pass** (join `ExamAttempt.passed`), không phải mọi người có readiness; thêm **per-domain accuracy breakdown** (demo S9 đã hứa "domain Security 64% vs cohort 81%"); fix N+1 trong `getAllBenchmarks`; giữ k-anonymity Gate 3.
- **KG perf (US-1001/US-1002):** IVFFlat index tạo khi ≥ ngưỡng rows; overlap compute chuyển sang BullMQ async job + cache invalidation; study plan persist (`StudyPlan` model) + effort estimate dùng cosine-weighted thay vì binary skip/learn.
- **Quality gates:** coverage ≥80% code mới; axe ≥95 trên FE mới (reputation leaderboard, saved study plan, benchmark domain breakdown); IVFFlat query p95 < ngưỡng; DDS+embedding cost trong quota; zero `describe.skip`.

**Demo script (Thu, end of S10):**

1. **DDS auto-apply:** Admin bật flag cohort "beta-rewriters". Linh mastery cao trên câu IAM → hệ propose hardened variant → vì cohort đã có 30 clean approvals, variant auto-apply sau gate → audit log hiện "auto-applied"; admin bấm rollback → về bản gốc. Tắt kill-switch → propose-only ngay lập tức.
2. **Quota guard:** Org gần hạn mức → propose variant thứ N → banner "DDS quota exceeded for this org" (HTTP 429), `LlmUsageEvent` không tăng.
3. **Reputation:** Mai có 3 explanation được vote lên top → reputation 45đ → badge **Silver Explainer**; squad leaderboard hiện Mai #1.
4. **Benchmark:** Linh xem "readiness 78 — top 10% **passers** ở 88 (n=24 passed)"; mở breakdown → "Security 64% vs cohort 81%, Networking 90% vs 72%".
5. **KG perf:** Trigger overlap recompute cho AWS SAA → chạy async (job id), graph load < ngưỡng nhờ IVFFlat; saved study plan AZ-104 mở lại từ DB không recompute.

---

## 2. Story Breakdown (~32 SP)

### 2a. Lane A — Knowledge Graph perf & persistence (8 SP)

| ID      | Title                                                                                         | SP  | Owner                | Depends      |
| ------- | --------------------------------------------------------------------------------------------- | --- | -------------------- | ------------ |
| US-1001 | IVFFlat index migration + overlap compute → BullMQ async job + cache invalidation             | 5   | Senior BE + Platform | US-807 (S9)  |
| US-1002 | Persist study plan (`StudyPlan` model) + cosine-weighted effort estimate + FE saved-plan view | 3   | BE + FE              | US-017c (S9) |

### 2b. Lane B — DDS auto-apply ramp (8 SP) — **headline beta feature**

| ID      | Title                                                                                    | SP  | Owner              | Depends              |
| ------- | ---------------------------------------------------------------------------------------- | --- | ------------------ | -------------------- |
| US-1003 | DDS cohort auto-apply gate — feature flag + ramp policy + kill-switch + auto-apply audit | 5   | AI Lead + BE + FE  | US-018 (S9), RFC-010 |
| US-1004 | DDS quota guard + shared LLM client + real token accounting                              | 3   | AI Lead + Platform | US-018 (S9), RFC-012 |

### 2c. Lane C — Reputation engine (5 SP)

| ID      | Title                                                                                     | SP  | Owner   | Depends     |
| ------- | ----------------------------------------------------------------------------------------- | --- | ------- | ----------- |
| US-1005 | Reputation engine — `UserReputation` + points accrual + tiered badges + squad leaderboard | 5   | BE + FE | US-020 (S9) |

### 2d. Lane D — Benchmark correctness (5 SP)

| ID      | Title                                                          | SP  | Owner   | Depends     |
| ------- | -------------------------------------------------------------- | --- | ------- | ----------- |
| US-1006 | Benchmark passers-only cohort + per-domain breakdown + fix N+1 | 5   | BE + FE | US-022 (S9) |

### 2e. Lane E — Cross-cutting (~6 SP)

| ID      | Title                                                                                                | SP  | Owner           |
| ------- | ---------------------------------------------------------------------------------------------------- | --- | --------------- |
| US-1010 | RFC promotions (RFC-007/RFC-010 Proposed→Accepted) + ADR-024 (DDS auto-apply) + ADR-025 (reputation) | 1   | Tech Lead       |
| US-1011 | Quality gates — coverage ≥80% mới, axe ≥95, visual baselines, strict-TS allow-list                   | 2   | Senior FE + QA  |
| US-1012 | Perf/observability — IVFFlat p95 + DDS auto-apply rate + reputation accrual Grafana panels           | 2   | Platform        |
| US-1013 | Bug pool + v2.0.0-beta release (cohort-gated) + S11 prep                                             | 1   | Whole team + SM |

### 2f. Descope ladder (pre-approved — bảo vệ Lane B)

Nếu Day 6 burndown trailing, descope theo thứ tự:

1. **US-1002 persist study plan defer → S11** (−3 SP) — compute vẫn chạy on-demand, chỉ chưa lưu/tái mở.
2. **US-1003 thu về "shadow mode"** (−2 SP) — tính decision auto-apply + log, **không** thực thi apply; bật apply tay S11.
3. **US-1005 leaderboard FE defer → S11** (−2 SP) — points accrual + tiered badge backend vẫn ship, chỉ thiếu UI leaderboard.
4. **Cuối cùng:** US-1001 giữ exact scan nếu row count < ngưỡng IVFFlat (−0 SP, giảm rủi ro) — index tạo S11 khi đủ rows.

---

## 3. Quality Gates

### Gate 1: IVFFlat viability (By Day 2)

| Điều kiện                                                            | Kết quả                                         |
| -------------------------------------------------------------------- | ----------------------------------------------- |
| `question_embeddings` rows ≥ ngưỡng (vd ≥10k) + index build < budget | ✅ GO — tạo IVFFlat `CONCURRENTLY`, đo p95      |
| Rows < ngưỡng                                                        | ⚠️ giữ exact scan; defer index S11 (descope #4) |
| Index build lock/timeout trên prod image                             | ❌ HOLD — exact scan, điều tra ops              |

**Owner:** Platform + Senior BE.

### Gate 2: DDS auto-apply correctness/safety (By Day 6)

| Điều kiện                                                      | Kết quả                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| n≥30 approvals, **0** correctness violation, rollback verified | ✅ GO — bật auto-apply cohort beta nhỏ, có kill-switch  |
| Có violation lẻ (<5%) hoặc reviewer còn nghi ngờ               | ⚠️ shadow mode (descope #2) — log decision, không apply |
| Correctness violation > 5% hoặc rollback lỗi                   | ❌ HOLD — propose-only, tune prompt, S11                |

**Owner:** AI Lead + Reviewer. Ghi ADR-024.

### Gate 3: Benchmark passers-cohort privacy (By Day 8)

| Điều kiện                                                                  | Kết quả                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------ |
| Cohort passers ≥ k-anonymity (n≥20 đã pass) + breakdown không lộ danh tính | ✅ GO — bật benchmark + domain breakdown PREMIUM |
| Cohort passers nhỏ cho 1 cert                                              | ⚠️ ẩn cert đó, hiện "chưa đủ candidate đã pass"  |
| Domain breakdown có rủi ro re-identification (cohort nhỏ per-domain)       | ❌ chỉ hiện percentile tổng, ẩn breakdown        |

**Owner:** Tech Lead + Security.

---

## 4. Day-by-Day Plan

### Week 1 (2026-06-09 → 06-13)

| Ngày    | Focus                                                                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mon** | Planning 90'. US-1001: IVFFlat migration draft + overlap job skeleton (BullMQ). US-1004: shared LLM client design. US-1006: passers-cohort query design.    |
| **Tue** | **Gate 1 (IVFFlat).** US-1001: overlap compute → async processor + cache invalidation. US-1003: feature flag + cohort model + auto-apply decision logic.    |
| **Wed** | US-1004: quota guard trong `proposeVariant` (429 khi vượt) + token accounting thật. US-1005: `UserReputation` migration + points accrual hook trong vote.   |
| **Thu** | US-1003: auto-apply executor (tái dụng approve path) + audit "auto-applied" + kill-switch. US-1006: per-domain breakdown query. US-1002: `StudyPlan` model. |
| **Fri** | US-1005: tiered badge logic (Bronze/Silver/Gold). US-1006 FE domain breakdown panel. US-1011 strict-TS allow-list. US-1012 Grafana panel skeleton.          |

### Week 2 (2026-06-16 → 06-20)

| Ngày    | Focus                                                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mon** | **Gate 2 (DDS auto-apply).** US-1003 FE cohort/kill-switch admin UI. US-1005 squad leaderboard FE. US-1002 FE saved-plan view.                                                      |
| **Tue** | US-1006 finalize + k-anonymity per-domain. US-1012 Grafana panels live (auto-apply rate, reputation accrual, IVFFlat p95). US-1010 ADR-024/025.                                     |
| **Wed** | **Gate 3 (benchmark privacy).** Code freeze. axe + visual + E2E green (auto-apply admin, reputation leaderboard, saved plan, benchmark breakdown). Demo dry-run. US-1013 bug sweep. |
| **Thu** | **Release v2.0.0-beta** — cohort-gated flags. Sprint Review + Retro. S11 prep seeded.                                                                                               |
| **Fri** | Post-release watch buffer; hotfix window.                                                                                                                                           |

---

## 5. Story Implementation Notes

### US-1001 — IVFFlat index + overlap async job (5 SP, Senior BE + Platform)

Acceptance:

- Migration mới: `CREATE INDEX CONCURRENTLY question_embeddings_ivfflat_idx ON question_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);` — chỉ chạy khi rows ≥ ngưỡng (Gate 1); reversible (`DROP INDEX CONCURRENTLY`).
- `computeOverlaps` (hiện synchronous, [knowledge-graph.service.ts:62](backend/src/knowledge-graph/knowledge-graph.service.ts)) chuyển sang BullMQ processor: enqueue per-cert job; per-pair upsert giữ nguyên logic cosine-centroid + Jaccard fallback. Cache invalidation: bump `computedAt`; endpoint trả 202 + jobId khi recompute.
- Đo overlap query p95 trước/sau index; log vào US-1012 panel.

Files: `backend/prisma/migrations/<ts>_ivfflat_index/migration.sql`, `backend/src/knowledge-graph/overlap.processor.ts` (mới), `backend/src/knowledge-graph/knowledge-graph.service.ts` (refactor compute → enqueue), `backend/src/knowledge-graph/knowledge-graph.module.ts` (register queue), `backend/test/knowledge-graph/overlap.spec.ts`.

### US-1002 — Persist study plan + cosine-weighted estimate (3 SP, BE + FE)

Acceptance:

- Model mới `StudyPlan(id, userId, targetCertId, sourceCertIds String[], skipTopics Json, mustLearnTopics Json, effortReductionPct, createdAt)`. `generateStudyPlan` ([knowledge-graph.service.ts:293](backend/src/knowledge-graph/knowledge-graph.service.ts)) lưu kết quả; endpoint `GET /knowledge-graph/study-plans` list saved plans của user.
- Effort estimate hiện binary (skip nếu overlap ≥ 0.65). Đổi sang weighted: `effortReduction = Σ(overlapPct của domain skip-able) / totalDomains` để estimate mượt hơn (vẫn clamp 30–50% theo AC US-017).
- FE: trang KG có tab "Saved plans"; mở plan không recompute.

Files: `backend/prisma/schema.prisma` (`StudyPlan`), `backend/src/knowledge-graph/knowledge-graph.service.ts`, `backend/src/knowledge-graph/knowledge-graph.controller.ts`, `src/components/knowledge-graph/StudyPlan.tsx`, `src/services/knowledgeGraph.ts`, `backend/test/knowledge-graph/study-plan.spec.ts`.

### US-1003 — DDS cohort auto-apply gate (5 SP, AI Lead + BE + FE)

Acceptance:

- Feature flag `dds.autoApply.cohort` (reuse cơ chế cohort flag S9). Decision logic: variant auto-apply **chỉ khi** (a) flag bật cho cohort của question/org, (b) cohort đã đạt ≥ N clean approvals (config), (c) Gate 2 GO. Mặc định **shadow mode** (descope #2): tính + log decision, không apply.
- Auto-apply executor tái dụng `approve` transaction ([dds.service.ts:122](backend/src/ai-question-bank/dds/dds.service.ts)) với `reviewedBy = 'auto'`; audit ghi `reviewNote = 'auto-applied (cohort=…, threshold=…)'`. Rollback giữ nguyên (giữ `originalChoices` trong diff).
- **Kill-switch:** tắt flag → mọi propose mới về propose-only ngay; variant đã auto-apply không bị đụng (chỉ rollback tay).
- Correctness invariant ([dds.service.ts:77](backend/src/ai-question-bank/dds/dds.service.ts)) vẫn enforce trước khi apply.
- FE admin: panel cohort + ngưỡng + kill-switch; danh sách auto-applied gần đây + nút rollback.

Files: `backend/src/ai-question-bank/dds/dds.service.ts` (thêm `evaluateAutoApply`, `autoApply`), `backend/src/ai-question-bank/dds/dds.controller.ts` (admin flag endpoints), `src/components/admin/DdsAutoApplyPanel.tsx` (mới), `src/components/admin/DdsVariantReview.tsx` (badge "auto-applied"), `backend/test/ai-question-bank/dds-auto-apply.spec.ts`.

### US-1004 — DDS quota guard + shared LLM client (3 SP, AI Lead + Platform)

Acceptance:

- `proposeVariant` gọi `LlmUsageService` để **check quota trước** khi gọi LLM; vượt → `ThrottledException`/429 với message rõ; không tạo variant, không tăng usage.
- Thay raw `fetch` ([dds.service.ts:242](backend/src/ai-question-bank/dds/dds.service.ts)) bằng shared LLM client (cùng client embedding/coach dùng) — bỏ logic Anthropic/OpenAI lặp.
- Token accounting thật: lấy `usage.input_tokens/output_tokens` từ response thay vì hardcode 600/300 ([dds.service.ts:300](backend/src/ai-question-bank/dds/dds.service.ts)).

Files: `backend/src/ai-question-bank/dds/dds.service.ts`, `backend/src/ai-question-bank/llm-usage/llm-usage.service.ts` (thêm `assertWithinQuota`), shared client (nếu chưa có: `backend/src/ai-question-bank/llm/llm-client.ts`), `backend/test/ai-question-bank/dds-quota.spec.ts`.

### US-1005 — Reputation engine (5 SP, BE + FE)

Acceptance:

- Model `UserReputation(userId, squadId, points, updatedAt)` (per-squad scope). Points accrual qua hook trong `vote`/`submitExplanation` ([peer-review.service.ts:85](backend/src/squads/peer-review/peer-review.service.ts)): +điểm khi explanation được upvote, bonus khi promoted-to-top. Idempotent (không double-count vote cũ).
- Tiered badge thay 1 badge nhị phân `top-explainer` ([peer-review.service.ts:167](backend/src/squads/peer-review/peer-review.service.ts)): Bronze/Silver/Gold theo ngưỡng points; upsert `BadgeAward` đúng tier.
- Endpoint `GET /squads/:squadId/reputation/leaderboard` (top N theo points, anonymizable). FE leaderboard trong squad view + reputation badge trên explanation author.

Files: `backend/prisma/schema.prisma` (`UserReputation`), `backend/src/squads/peer-review/peer-review.service.ts` (accrual + tier logic), `backend/src/squads/peer-review/peer-review.controller.ts` (leaderboard endpoint), `src/components/squads/SquadReputationLeaderboard.tsx` (mới), `src/components/squads/PeerReviewChallenge.tsx` (badge tier), `backend/test/squads/reputation.spec.ts`.

### US-1006 — Benchmark passers cohort + domain breakdown (5 SP, BE + FE)

Acceptance:

- Cohort đổi từ "mọi user có `ReadinessScore`" ([benchmark.service.ts:36](backend/src/analytics/benchmark/benchmark.service.ts)) sang **chỉ candidate đã pass** (join `ExamAttempt` where `passed = true` cho cert đó). Percentile/top10/average tính trên cohort passers.
- Thêm `domainBreakdown: { domainId, domainName, userAccuracy, cohortAccuracy }[]` — accuracy của user vs cohort passers theo từng domain (từ `AttemptEvent`/answer history).
- k-anonymity Gate 3 áp cả tổng và per-domain (ẩn domain nếu cohort per-domain < ngưỡng).
- Fix N+1: `getAllBenchmarks` ([benchmark.service.ts:88](backend/src/analytics/benchmark/benchmark.service.ts)) gom 1 query thay vì loop `getBenchmark` per cert.

Files: `backend/src/analytics/benchmark/benchmark.service.ts`, `backend/src/analytics/benchmark/benchmark.controller.ts`, `src/components/dashboard/BenchmarkPanel.tsx` (domain breakdown), `backend/test/analytics/benchmark.spec.ts`.

### US-1010 — RFC/ADR (1 SP, Tech Lead)

- RFC-007 (pgvector) + RFC-010 (DDS) Proposed → **Accepted** (đã chạy production alpha). ADR-024 (DDS auto-apply policy: ngưỡng, kill-switch, rollback retention). ADR-025 (reputation model + tier thresholds).

### US-1011 — Quality gates (2 SP, Senior FE + QA)

- Coverage ≥80% cho code mới (overlap.processor, dds auto-apply/quota, reputation, benchmark). axe ≥95 + visual baselines 4 breakpoints (DDS auto-apply admin, reputation leaderboard, saved study plan, benchmark domain breakdown). Strict-TS allow-list cập nhật cho file mới. Zero `describe.skip`.

### US-1012 — Perf/observability (2 SP, Platform)

- Grafana panels: IVFFlat overlap query p95, DDS auto-apply rate + rollback rate, reputation accrual volume, DDS/embedding cost theo feature (extend RFC-012).

### US-1013 — Bug pool + beta release + S11 prep (1 SP, whole team + SM)

- Monitor v2.0.0-beta: auto-apply correctness in the wild, reputation gaming, benchmark cohort coverage, IVFFlat recall. S11 candidates: auto-apply GA ramp (cohort mở rộng), reputation anti-gaming, KG real-time recompute on question edit, study-plan scheduling. Execution log.

---

## 6. Cross-cutting Engineering Tasks

| Task                                                              | Owner           | Deadline |
| ----------------------------------------------------------------- | --------------- | -------- |
| IVFFlat index migration trên prod image (Gate 1)                  | Platform        | Day 2    |
| ADR-024 DDS auto-apply policy (Gate 2)                            | AI Lead         | Day 6    |
| Shared LLM client extraction (DDS + embedding + coach dùng chung) | AI Lead         | Day 3    |
| ADR-025 reputation model + tier thresholds                        | Tech Lead       | Day 8    |
| k-anonymity per-domain guard (Gate 3)                             | Tech Lead + Sec | Day 8    |
| Cohort feature-flag plumbing reuse (S9 mechanism)                 | BE              | Day 2    |

---

## 7. Capacity & Allocation

| Role               | Capacity (SP) | Allocated                                         |
| ------------------ | ------------- | ------------------------------------------------- |
| AI Lead            | 6             | US-1003 (3 share), US-1004 (2 share), ADR-024 (1) |
| Senior BE          | 5             | US-1001 (4), US-1006 BE (1 share)                 |
| BE                 | 6             | US-1002 BE (1), US-1005 BE (3), US-1006 BE (2)    |
| Senior FE          | 4             | US-1003 FE (2), US-1011 (1), polish (1)           |
| FE                 | 5             | US-1002 FE (1), US-1005 FE (2), US-1006 FE (2)    |
| Platform           | 4             | US-1001 ops (1), US-1004 (1 share), US-1012 (2)   |
| Security/Tech Lead | 1             | US-1010 + Gate 3                                  |
| QA                 | 1             | US-1011 a11y + visual + E2E                       |
| SM + PO            | 0 (overhead)  | US-1013 + execution log                           |
| **Total**          | **~32**       | (conservative — descope ladder §2f)               |

---

## 8. Risks

| Rủi ro                                                         | P×I | Mitigation                                                                         | Owner     |
| -------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------- | --------- |
| Auto-apply làm hỏng correctness trên data thật                 | M×H | Gate 2 n≥30 clean; shadow mode default; kill-switch; correctness invariant enforce | AI Lead   |
| IVFFlat recall thấp (lists=100 chưa tune) → dedup/overlap miss | M×M | Đo recall vs exact scan; tune `lists`/`probes`; giữ exact fallback                 | Senior BE |
| Reputation gaming (vote vòng trong squad)                      | M×M | Idempotent vote (đã có); cấm self-vote (đã có); S11 anti-gaming theo dõi           | BE        |
| Benchmark cohort passers quá nhỏ → nhiều cert bị ẩn            | M×M | k-anonymity ẩn có chủ đích; truyền thông "đang gom dữ liệu"; theo dõi coverage     | Tech Lead |
| Shared LLM client refactor đụng embedding/coach đang chạy      | L×H | Refactor sau test xanh; behind interface; regression test embedding+coach+dds      | AI Lead   |
| Scope hardening bị kéo thành feature mới                       | M×M | Lane rõ ràng map gap code; PO bảo vệ "no new v2.0 story"; descope ladder           | SM        |

---

## 9. Exit Checklist

### Lane A — KG perf & persistence

- [ ] IVFFlat index tạo (hoặc ghi defer S11 nếu rows < ngưỡng, Gate 1) — reversible.
- [ ] `computeOverlaps` chạy qua BullMQ async job + cache invalidation; endpoint trả jobId.
- [ ] `StudyPlan` model + persist + FE saved-plan view; effort estimate cosine-weighted.

### Lane B — DDS auto-apply

- [ ] Feature flag cohort + ngưỡng N + kill-switch; shadow mode default.
- [ ] Auto-apply executor tái dụng approve path; audit "auto-applied"; rollback verified; correctness invariant giữ.
- [ ] Quota guard 429 khi vượt; shared LLM client; token accounting thật. ADR-024.

### Lane C — Reputation

- [ ] `UserReputation` model + points accrual idempotent; tiered badges (Bronze/Silver/Gold).
- [ ] Squad reputation leaderboard endpoint + FE. ADR-025.

### Lane D — Benchmark

- [ ] Cohort = passers (join `ExamAttempt.passed`); per-domain breakdown; k-anonymity tổng + per-domain.
- [ ] `getAllBenchmarks` N+1 fixed.

### Cross-cutting

- [ ] RFC-007 + RFC-010 Proposed → Accepted.
- [ ] Coverage ≥80% module mới; axe ≥95 (auto-apply admin, reputation leaderboard, saved plan, benchmark breakdown); visual baselines green.
- [ ] Grafana panels: IVFFlat p95, auto-apply rate, reputation accrual, cost.
- [ ] Zero `describe.skip`.
- [ ] v2.0.0-beta tagged (cohort-gated); release notes published.
- [ ] Sprint Retro held; S11 prep seeded (auto-apply GA ramp, reputation anti-gaming, KG real-time recompute, study-plan scheduling).
