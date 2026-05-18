# Sprint 6 — "Next Frontier: AI Coach + Scenarios" Implementation Plan

- **Version target:** v1.4.0-beta
- **Capacity:** 48 SP (velocity hold từ Sprint 5)
- **Window:** 2026-06-12 → 2026-06-26 (2 tuần)
- **Status as of 2026-06-12:** Sprint 5 retro hoàn thành (2026-06-11). Tất cả 45/48 SP đã ship. **4 carry-forward items** phát hiện qua code audit được tích hợp vào sprint này. 23 squads đang active — Gate 2 (≥5 squads) đã được thoả mãn trước. Predictor go/no-go: **WIDEN ROLLOUT** (r = 0.5823).
- **Sprint goal:** Dọn sạch technical debt từ Sprint 5 (un-skip E2E tests, RLS Phase-3), widen Pass Predictor lên GA, harden AI Coach 1-1 beta (pending Gate 1), ship Squad Daily Challenge + Burnout Detection, và chạy Scenario Engine spike.

Source artefacts:

- [sprint-05-retro.md §3a Carry-forward Items](./sprint-05-retro.md)
- [sprint-06-prep.md](./sprint-06-prep.md) — candidate stories, capacity, decision gates
- [00-master-roadmap.md §Sprint 6–8 "Next Frontier"](./00-master-roadmap.md)
- [docs/security/rls-rollout.md](../security/rls-rollout.md) — RLS phase status table

---

## 1. Sprint Goal & Demo

**Goal Hit Criteria:**

- **[CF] RLS E2E green:** `describe.skip` được xoá khỏi `rls.cross-org.e2e-spec.ts`; toàn bộ 30+ test case Phase-1 + Phase-2 pass trên CI.
- **[CF] LLM Quota E2E green:** `describe.skip` xoá khỏi `llm-usage.e2e-spec.ts`; quota blocking được kiểm chứng end-to-end.
- **[CF] RLS Phase-3:** RLS enabled trên `org_exam_catalog`, `org_analytics`; regression suite green; latency budget held.
- **Predictor GA:** `FF_PREDICTOR_BETA` flip lên GA; Grafana live-correlation panel live.
- **AI Coach Gate (EOD Week 1):** Retention analysis xong; go/no-go documented. Nếu **go** (Day-7+ ≥50%): RFC-010 hardening ship (8 SP); nếu **no-go**: US-513 + US-514 nhận 8 SP.
- **Squad Daily Challenge:** Daily quiz trong squad context; leaderboard; gamification badges. Behind `FF_SQUAD_DAILY_CHALLENGE`.
- **Burnout Detection:** Nightly job + in-app banner + snooze. False-alert rate <5%. Behind `FF_BURNOUT_ALERT`.
- **Scenario Engine spike (E4):** Prompt eval + cost model + RFC-011 draft committed.

**Demo script (Thu, end of S6):**

1. **CI gate:** Chạy E2E suite trực tiếp — không còn `describe.skip`; toàn bộ RLS + LLM quota tests pass.
2. **Predictor GA:** User không thuộc beta cohort mở Mastery Dashboard → ReadinessGauge hiển thị. Grafana panel cho thấy r-correlation live trend.
3. **RLS Phase-3:** Thử cross-org read trên `org_exam_catalog` → 0 rows trả về; Grafana denial counter tăng.
4. **Squad Daily Challenge:** Mai login → squad dashboard hiện "Today's Challenge: 10 câu hỏi về IAM". Sau khi hoàn thành, leaderboard refresh; badge mở khoá ngày thứ 3 streak.
5. **Burnout Detection:** Account demo inactive 7+ ngày → banner xuất hiện: _"Chúng tôi nhớ bạn! Streak SAA-C03 của bạn đang rất tốt."_ Snooze dismiss 7 ngày.
6. **AI Coach (nếu go):** Session persist qua page reload; >10 sessions/day → 429 graceful; cost panel <$0.10/session.
7. **Scenario spike:** 3 sample passages được generate; quality score, cost/scenario, RFC-011 draft mở.

---

## 2. Story Breakdown (48 SP)

### 2a. Carry-forward từ Sprint 5 (7 SP — ưu tiên cao nhất)

| ID         | Title                                                   | SP  | Owner                  | Nguồn gốc                     |
| ---------- | ------------------------------------------------------- | --- | ---------------------- | ----------------------------- |
| S6-CF-01   | **Un-skip RLS E2E test suite + fix failing assertions** | 3   | Security Champion + BE | CF-01 từ S5 retro §3a         |
| S6-CF-02   | **Un-skip LLM Quota E2E test + wire integration**       | 2   | Platform + BE          | CF-02 từ S5 retro §3a         |
| S6-US-502c | **RLS Phase-3 — `org_exam_catalog`, `org_analytics`**   | 5   | Security Champion      | CF-04; rls-rollout.md Phase 3 |

### 2b. New stories Sprint 6 (41 SP)

| ID     | Title                                                    | SP  | Owner          | Lane       | Depends           |
| ------ | -------------------------------------------------------- | --- | -------------- | ---------- | ----------------- |
| US-601 | Pass Predictor GA — flip flag + Grafana live-correlation | 2   | Platform + PO  | Foundation | CF-03; S5 US-501  |
| US-602 | AI Coach retention analysis + RFC-010 go/no-go doc       | 2   | PO + Data      | Gate/Spike | S4 alpha cohort   |
| US-603 | RFC-010 hardening — session persist, rate-limit, cost    | 8   | Senior BE      | Feature BE | US-602 go         |
| US-011 | Squad Daily Challenge (BE + FE + gamification)           | 5   | Senior FE + BE | Feature    | S5 US-505, US-506 |
| US-015 | Burnout Detection — nightly job + banner + snooze        | 3   | Senior BE + FE | Feature    | S5 US-503         |
| E4     | Scenario Engine spike — prompt eval + cost + RFC-011     | 5   | Senior BE      | Spike      | —                 |
| US-513 | Squad Settings — name, exam date, capacity               | 3   | FE + BE        | Feature    | S5 US-505         |
| US-609 | Strict TS rollout — `coach/`, `burnout/`, `challenge/`   | 2   | Senior FE      | Tech debt  | S5 US-509         |
| US-610 | Bug pool + post-release watch (v1.3.0-alpha metrics)     | 2   | Whole team     | Buffer     | —                 |
| US-611 | Retro action items + Sprint 7 prep                       | 1   | SM             | Process    | —                 |

**Total: 7 (carry) + 33 (new committed) + 8 (gated US-603) = 48 SP.**

**Branch nếu RFC-010 no-go (EOD Day 5):** Drop US-603 (8 SP) → thêm US-514 Squad Activity Feed (5 SP) + Predictor heuristic tuning (3 SP).

**Descope order nếu Day 8 burndown trailing:** US-609 → US-513 → E4 thu hẹp về 3 SP (prompt eval only) → US-502c trì hoãn sang S7.

---

## 3. Decision Gates

### Gate 1: AI Coach Retention (EOD Week 1, Day 5)

| Điều kiện               | Kết quả                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| Day-7+ retention ≥ 50%  | ✅ GO — US-603 RFC-010 hardening tiếp tục                            |
| Day-7+ retention 30–49% | ⚠️ CAUTION — thu hẹp US-603 về 4 SP (session persistence only)       |
| Day-7+ retention < 30%  | ❌ NO-GO — drop US-603; thêm US-514 (5 SP) + Predictor tuning (3 SP) |

**Owner:** PO + Data (US-602). Decision ghi trong `docs/adr/ADR-018-ai-coach-beta-go-nogo.md`.

### Gate 2: Squad Adoption (EOD Week 2, Day 10)

Đã thoả mãn trước: **23 squads active** (target ≥5). US-011 tiếp tục full scope.

### Gate 3: LLM Cost Model (By Day 3)

| Điều kiện                | Kết quả                          |
| ------------------------ | -------------------------------- |
| Cost/session < $0.10     | ✅ GO — wider PREMIUM-only beta  |
| Cost/session $0.10–$0.20 | ⚠️ CAUTION — cap 5 sessions/ngày |
| Cost/session > $0.20     | ❌ PAUSE — defer sang Sprint 7   |

**Owner:** Platform + Senior BE (nằm trong US-602).

---

## 4. Day-by-Day Plan

### Week 1 (2026-06-12 → 06-18)

| Ngày    | Focus                                                                                                                                                                                                                                                                                                                             |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fri** | Planning 90'. **Ưu tiên 1:** Security Champion bắt đầu S6-CF-01 — đọc toàn bộ `rls.cross-org.e2e-spec.ts`, lập danh sách controllers còn thiếu. Platform bắt đầu S6-CF-02 — trace LlmQuotaService vào test fixture. US-602 retention analysis kickoff. Feature flags `FF_SQUAD_DAILY_CHALLENGE` + `FF_BURNOUT_ALERT` provisioned. |
| **Mon** | **CF sprint:** S6-CF-01 — wire missing OrgGroup/OrgInvite/Assessment controllers; un-skip Phase-1 test block; run locally green. S6-CF-02 — wire LlmUsageService + LlmQuotaService vào test module; un-skip và chạy. BE: US-015 burnout detector skeleton. FE: US-011 DailyChallengeCard Storybook.                               |
| **Tue** | S6-CF-01 — un-skip Phase-2 block; fix assertion mismatches. S6-CF-02 — all quota test cases pass locally. **US-601** — flip `FF_PREDICTOR_BETA` lên GA env toggle; Grafana panel live. US-603 session persistence schema + Redis adapter. E4 spike: generate 10 sample scenarios.                                                 |
| **Wed** | **Gate 3 LLM cost model xong (Platform + BE).** S6-CF-01 + S6-CF-02 PR lên; CI xanh. S6-US-502c — draft RLS Phase-3 migration cho `org_exam_catalog`. US-015 in-app BurnoutBanner + snooze. US-011 BE: challenge generation endpoint + BullMQ nightly builder.                                                                    |
| **Thu** | **Gate 1 decision (US-602 xong, EOD).** ADR-018 committed. US-011 FE: LeaderboardCard + streak badge logic. S6-US-502c — migration applied staging; OrgExamCatalog controller wired. axe gate trên `/squads/:slug`.                                                                                                               |
| **Fri** | Refinement. US-513 Squad Settings page. E4 spike: quality scoring vs. baseline + cost model. S6-US-502c — OrgAnalytics controller wired; cross-org regression cases viết. US-015 false-alert smoke-test.                                                                                                                          |

### Week 2 (2026-06-19 → 06-25)

| Ngày    | Focus                                                                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mon** | S6-US-502c — Phase-3 E2E regression suite green; k6 latency re-run. US-603 rate-limiter + 429 path (nếu Gate 1 go). US-011 gamification: UserBadge 3/7/30 ngày streak. |
| **Tue** | US-609 strict TS rollout merged. E4: RFC-011 draft committed. US-513 tests green. US-603 Coach monitoring wired (nếu go).                                              |
| **Wed** | Code freeze. axe + visual + E2E gates green. **CI gate check:** zero `describe.skip` trên E2E suite. Demo dry run với PO. US-610 bug pool sweep.                       |
| **Thu** | **Release v1.4.0-beta** behind `FF_SQUAD_DAILY_CHALLENGE`, `FF_BURNOUT_ALERT`, `FF_AI_COACH_HARDENED` (nếu go). Sprint Review + Retro. Sprint 7 prep seeded.           |

---

## 5. Story Implementation Notes

### S6-CF-01 — Un-skip RLS E2E test suite (3 SP, Security Champion + BE)

**Bối cảnh:** `rls.cross-org.e2e-spec.ts` có `describe.skip` toàn bộ ở line 23. File chứa cả Phase-1 (`org_members`, `org_questions`) và Phase-2 (`org_groups`, `org_invites`, `assessments`) test cases. Migrations đã apply, RLS policies đã enable, nhưng NestJS controllers để Phase-2 test gọi vào có thể còn thiếu guard.

Acceptance:

- Xoá `describe.skip` ở line 23; thay bằng `describe(...)`.
- Mỗi test block chạy tuần tự: un-skip Phase-1 trước, fix nếu có assertion lỗi, sau đó Phase-2.
- Xác định controllers thiếu (OrgGroup, OrgInvite, Assessment routes) — implement minimal guard layer nếu chưa có.
- Toàn bộ 30+ test cases pass trên `npm run test:e2e` và GitHub CI.
- `docs/security/rls-rollout.md` Phase-1 + Phase-2 cập nhật "E2E test suite: ✅ Green".

Files:

- `backend/test/security/rls.cross-org.e2e-spec.ts` (remove skip)
- `backend/src/organizations/organizations.controller.ts` (nếu cần thêm route)
- `docs/security/rls-rollout.md`

### S6-CF-02 — Un-skip LLM Quota E2E test (2 SP, Platform + BE)

**Bối cảnh:** `llm-usage.e2e-spec.ts` có `describe.skip` ở line 20. US-507 implement quota blocking trong `LlmQuotaService` nhưng E2E fixture chưa wire đủ dependencies vào TestingModule.

Acceptance:

- Xoá `describe.skip`; wire `LlmUsageService`, `LlmQuotaService`, BullMQ mock vào TestingModule.
- Test cases xác nhận: (a) usage event được ghi sau mỗi AI gen call, (b) over-quota trả về 429, (c) reset counter hoạt động.
- Pass trên CI `npm run test:e2e`.

Files:

- `backend/test/llm-usage.e2e-spec.ts` (remove skip, fix fixture)
- `backend/test/jest-e2e.json` (nếu cần thêm setup)

### S6-US-502c — RLS Phase-3 (5 SP, Security Champion + BE)

Acceptance:

- RLS enabled trên `org_exam_catalog`, `org_analytics`. Policy mirror Phase-1/2: `FOR ALL USING (org_id::text = COALESCE(current_setting('app.org_id', true), ''))`.
- Migration reversible; rollback documented.
- Regression test cases thêm vào `rls.cross-org.e2e-spec.ts` (hoặc file riêng nếu dài).
- k6 re-run: p95 phải trong ±10% baseline Phase-2 (387ms).
- `docs/security/rls-rollout.md` Phase-3 status: ✅ Complete.

Files:

- `backend/prisma/migrations/<ts>_rls_phase3/`
- `backend/test/security/rls.cross-org.e2e-spec.ts` (thêm Phase-3 blocks)
- `docs/security/rls-rollout.md`

### US-601 — Pass Predictor GA (2 SP, Platform + PO)

Acceptance:

- `FF_PREDICTOR_BETA` condition đổi từ per-user `featureFlags.passPredictorBeta` check sang global `PREDICTOR_GA=true` env toggle. Beta cohort flag giữ nguyên cho A/B analysis sau này.
- Mastery Dashboard hiển thị ReadinessGauge cho **tất cả** users (premium: full gauge; free: blurred + CTA — gate cũ không thay đổi).
- Grafana panel: phân phối `readiness_score` + weekly r-correlation trend.
- Rollback: flip `PREDICTOR_GA=false` không cần deploy.

Files:

- `backend/src/insights/readiness/readiness.service.ts` (cập nhật flag check)
- `src/components/mastery/ReadinessGauge.tsx` (xoá beta-cohort check)
- `docs/security/privacy-events.md` (ghi chú GA)

### US-602 — AI Coach Retention Analysis (2 SP, PO + Data)

- Pull `coach_session_events` cho Sprint 4 alpha cohort (n ≥ 50).
- Tính Day-7+ retention: unique users mở Coach trong week 2+ sau session đầu tiên.
- Output: `docs/adr/ADR-018-ai-coach-beta-go-nogo.md` với retention rate, session depth histogram, cost/session. Decision EOD Day 5.

### US-603 — RFC-010: AI Coach 1-1 Hardening (8 SP, Senior BE)

**Điều kiện: Gate 1 go.**

Acceptance:

- Multi-turn conversation state persist trong Redis (`coach:session:{userId}:{sessionId}`) TTL 24h; session tiếp tục qua page reload.
- Rate limit: 10 Coach sessions/ngày per PREMIUM user → 429 với `resetAt` + billing nudge.
- Cost tracking qua `LlmUsageEvent` ledger; Grafana: `coach_cost_usd / session`.
- Error recovery: LLM call fail → partial response lưu; user thấy "Tiếp tục từ đây" khi mở lại.
- Session abandonment metric: `coach.session.abandoned` Prometheus counter.
- Feature flag: `FF_AI_COACH_HARDENED`.

Files:

- `backend/src/coach/coach.service.ts`
- `backend/src/coach/coach.session.store.ts` (Redis adapter)
- `backend/src/coach/coach.controller.ts` (429 path)
- `backend/test/coach/coach.e2e-spec.ts`

### US-011 — Squad Daily Challenge (5 SP, Senior FE + BE)

Acceptance:

- Nightly BullMQ job `challenge:daily:generate` tạo `DailyChallenge { squadId, certificationId, questionIds[10], date }`; questions sample proportionally theo readiness gaps.
- Endpoint: `GET /api/v1/squads/:id/daily-challenge` → challenge hoặc 404.
- FE: `<DailyChallengeCard />` trên Squad Dashboard — question count, domains, time estimate; "Start" → `/exam?mode=daily-challenge&challengeId=<id>`.
- Leaderboard card refresh sau mỗi member hoàn thành: top-3 avatars + scores.
- Gamification: `UserBadge` ghi sau 3/7/30 ngày streak liên tiếp. Badge stub trên profile.
- Feature flag: `FF_SQUAD_DAILY_CHALLENGE`.
- Visual regression baseline: Squad Dashboard có/không có challenge, có/không có leaderboard.

Files:

- `backend/prisma/schema.prisma` (+`DailyChallenge`, +`UserBadge`)
- `backend/src/squads/challenge/challenge.processor.ts`
- `backend/src/squads/challenge/challenge.service.ts`
- `backend/src/squads/challenge/challenge.controller.ts`
- `src/components/squads/DailyChallengeCard.tsx`
- `src/components/squads/LeaderboardCard.tsx`
- `backend/test/squads/challenge.e2e-spec.ts`

### US-015 — Burnout Detection (3 SP, Senior BE + FE)

Acceptance:

- Detection logic trong `backend/src/insights/burnout/detector.ts`: user có ≥14 ngày daily activity liên tiếp → sau đó N ngày không có activity (`OrgSettings.burnoutInactivityDays`, default 7). Pure function, 100% branch coverage.
- Nightly job `insights:burnout:nightly` ghi `BehavioralInsight { kind: 'burnout_risk', payload: { lastActiveDays, streakLength } }`.
- FE: `<BurnoutBanner />` trên dashboard khi có fresh `burnout_risk` insight. Snooze persist `dismissedInsightIds` 7 ngày (pattern từ US-504).
- False-alert guard: chỉ fire nếu `streakLength ≥ 14`.
- Metric: `burnout.alerts.fired` vs `burnout.alerts.dismissed_within_1h`.
- Feature flag: `FF_BURNOUT_ALERT`.
- a11y: `role="alert"`, `aria-live="assertive"`.

Files:

- `backend/src/insights/burnout/detector.ts`
- `backend/src/insights/burnout/burnout.processor.ts`
- `src/components/dashboard/BurnoutBanner.tsx`
- `backend/test/insights/burnout.e2e-spec.ts`

### E4 — Scenario Engine Spike (5 SP, Senior BE)

**Spike output only — không có migrations, không có feature flags, không có prod code.**

- Prompt template: `backend/src/ai/prompts/scenario-generator.ts` — generate 200–400 word passage + 3–5 contextual questions.
- Quality eval: so sánh 10 AI-generated scenarios vs 10 single-question baselines (specificity, plausibility, distractors). Ghi vào `docs/spikes/E4-scenario-engine.md`.
- Cost model: đo `inputTokens`, `outputTokens` per scenario trên `claude-haiku-4-5` vs `claude-sonnet-4-6`; tính $/scenario.
- RFC-011 draft: `docs/adr/RFC-011-scenario-engine.md` với findings, recommendation, estimated Sprint 7 effort.

### US-513 — Squad Settings Page (3 SP, FE + BE)

Acceptance:

- Route: `/squads/:slug/settings` — OWNER only (403 cho MEMBER).
- Editable: squad name, target exam date, member capacity (min 2, max 50).
- `PATCH /api/v1/squads/:id` — partial update; validate capacity ≥ số member hiện tại.
- Success toast; unsaved-changes guard (beforeunload warning).
- Visual regression baseline thêm.

### US-609 — Strict TS rollout (2 SP, Senior FE)

- Thêm `coach/`, `burnout/`, `squads/challenge/` (FE + BE) vào RFC-009 strict-TS allow-list.
- Cap diff 200 LOC; file ticket nếu lớn hơn. Cập nhật RFC-009 status table.

### US-610 — Bug pool + post-release watch (2 SP)

- Monitor v1.3.0-alpha metrics Days 1–5: squad creation rate, readiness recompute SLA, RLS denial counter, quota firing rate.

### US-611 — Retro + Sprint 7 prep (1 SP, SM)

- Sprint 7 candidates: Scenario Engine full feature (RFC-011), Predictor heuristic tuning, Squad Activity Feed (US-514), AI Coach production rollout (RFC-010 Phase 2), billing portal stub.

---

## 6. Cross-cutting Engineering Tasks

| Task                                                                                           | Owner             | Deadline             |
| ---------------------------------------------------------------------------------------------- | ----------------- | -------------------- |
| **CI gate: zero `describe.skip` rule** — thêm pre-E2E check vào `jest-e2e.json` hoặc CI script | Platform          | Day 3                |
| Feature flags: `FF_SQUAD_DAILY_CHALLENGE`, `FF_BURNOUT_ALERT`, `FF_AI_COACH_HARDENED`          | Platform          | Day 2                |
| Privacy doc: DailyChallenge + BurnoutInsight data retention (90 ngày)                          | Tech Lead         | Day 4                |
| Grafana dashboards: Coach cost/session, burnout alert rate, challenge completion rate          | Platform          | Day 4                |
| ADR-018: AI Coach go/no-go                                                                     | PO + Tech Lead    | EOD Day 5            |
| RFC-011 draft: Scenario Engine recommendation                                                  | Senior BE         | Day 11               |
| `docs/security/rls-rollout.md` Phase-3 cập nhật                                                | Security Champion | Khi S6-US-502c merge |

---

## 7. Definition of Done (Sprint 6 bổ sung)

Ngoài DoD chuẩn, Sprint 6 thêm 2 điều kiện mới từ carry-forward learnings:

- **Zero `describe.skip` gate:** CI step mới chạy `grep -r "describe\.skip" backend/test/` và fail nếu tìm thấy — ngăn lặp lại vấn đề CF-01/CF-02.
- **E2E count gate:** `jest --listTests` kết hợp với test count phải ≥ con số trong sprint trước để phát hiện accidentally-skipped suites.

---

## 8. Risks & Mitigations

| Risk                                                                                | P×I | Mitigation                                                                            | Owner             |
| ----------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------- | ----------------- |
| S6-CF-01: un-skip RLS tests phát hiện bug thực trong controller layer → scope creep | H×M | Timebox 3 SP; nếu >3 SP fix cần thiết → file critical bug, tách PR riêng              | Security Champion |
| Gate 1 no-go (retention <50%) → 8 SP US-603 dropped giữa sprint                     | M×H | Alternate 8 SP path pre-planned: US-514 (5) + Predictor tuning (3); re-plan EOD Day 5 | PO                |
| S6-US-502c RLS Phase-3 tăng latency quá 10%                                         | M×M | k6 re-run bắt buộc trước merge; rollback per-table migration                          | Security Champion |
| Daily Challenge generation chậm với cert bank lớn                                   | M×M | Cap sample pool 200 questions/run; p95 target <5s                                     | Senior BE         |
| Burnout detection false-positive >5%                                                | M×M | Threshold guard (streak ≥14 ngày); smoke-test trên seed data                          | Senior BE         |
| Scenario spike quality không đủ → RFC-011 recommends không đi tiếp                  | L×M | Spike vẫn có giá trị: cost model + decision criteria documented                       | Senior BE         |

---

## 9. Capacity & Allocation

| Role              | Capacity (SP) | Allocated                                                                  |
| ----------------- | ------------- | -------------------------------------------------------------------------- |
| Security Champion | 8             | S6-CF-01 (3), S6-US-502c (5)                                               |
| Platform          | 5             | S6-CF-02 (2), US-601 flag (1), US-610 monitoring (1), CI gate (1)          |
| Senior BE         | 11            | US-603 (8 nếu go) / US-514+tuning (8 nếu no-go), US-015 BE (2), buffer (1) |
| BE                | 8             | E4 spike (5), US-011 BE (2), US-513 BE (1)                                 |
| Senior FE         | 8             | US-011 FE (2.5), US-609 (2), US-601 FE (0.5), polish (3)                   |
| FE                | 6             | US-011 FE (2.5), US-015 FE (1), US-513 FE (2), buffer (0.5)                |
| Data              | 3             | US-602 (2), burnout threshold tuning (1)                                   |
| PO + SM           | —             | US-602 (2 PO), US-611 (1 SM), facilitation                                 |
| **Total**         | **48**        |                                                                            |

---

## 10. Exit Checklist

### Carry-forward (ưu tiên trước new features)

- [ ] `describe.skip` xoá khỏi `rls.cross-org.e2e-spec.ts`; 30+ test cases pass CI.
- [ ] `describe.skip` xoá khỏi `llm-usage.e2e-spec.ts`; quota blocking E2E pass CI.
- [ ] CI gate "zero describe.skip" active — ngăn tái diễn.
- [ ] RLS Phase-3 enabled trên `org_exam_catalog`, `org_analytics`; regression suite green; latency budget held.
- [ ] `docs/security/rls-rollout.md` Phase-3 cập nhật ✅.

### New features

- [ ] `FF_PREDICTOR_BETA` flip lên GA; Grafana live-correlation panel live; non-beta users thấy ReadinessGauge.
- [ ] AI Coach retention analysis xong; ADR-018 go/no-go committed EOD Day 5.
- [ ] (Nếu go) RFC-010 hardening ship behind `FF_AI_COACH_HARDENED`; session persist + rate-limit + cost panel live.
- [ ] Squad Daily Challenge live behind `FF_SQUAD_DAILY_CHALLENGE`; leaderboard + streak badges working; challenge job verified staging.
- [ ] Burnout Detection running nightly; banner + snooze working; false-alert rate <5%.
- [ ] E4 Scenario spike xong; RFC-011 draft committed.
- [ ] Squad Settings page live; OWNER-only guard verified; 403 regression test green.
- [ ] Strict TS: `coach/`, `burnout/`, `squads/challenge/` thêm vào allow-list; RFC-009 status table cập nhật.
- [ ] axe-core + visual regression + Lighthouse perf ≥85 / a11y ≥95 green trên `/squads/:slug`, `/dashboard/mastery`.
- [ ] Privacy docs cập nhật cho DailyChallenge + BurnoutInsight.
- [ ] Sprint Retro held; Sprint 7 prep seeded.
