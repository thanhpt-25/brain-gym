# 04 — UX Lead & QA Lead Strategy (CertGym / Brain Gym)

> Author: UX Lead kiêm QA Lead
> Status: **Proposed v1**
> Scope: 5 feature mới (Question SRS, Exam Readiness, Behavioral Insights, Training Squads, AI Coach)

---

## Phần A — UX Strategy

### 1. Design direction (anti-template)

Brain Gym KHÔNG phải dashboard SaaS chung chung. Vision rõ là **"Training System, not a question bank"** — tức là người dùng cần cảm giác bước vào một **phòng tập trí não**: tập trung, có nhịp, đo được tiến bộ, có chút áp lực thi đấu. Vì vậy chọn 2 direction kết hợp:

| Direction                          | Lý do                                                                                                                                                                                                                                                                           | Áp dụng ở đâu                                       |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------- |
| **Editorial / Bento** (chính)      | Cho phép phá grid đều đặn — Dashboard, Readiness Score, Behavioral Insights cần hierarchy mạnh, các chỉ số "Pass Probability 82%" phải đập vào mắt như tít báo. Bento giúp gom nhiều mảnh dữ liệu (streak, weak domain, next review, squad rank) mà không nhìn như admin panel. | Dashboard, Readiness, Squad, Behavioral Insights    |
| **Dark luxury (focus mode)** (phụ) | Khi vào Exam / Flashcard / SRS Review: low chrome, contrast cao, không decoration thừa. Đây là "trên thảm tập" — không có gì xen vào.                                                                                                                                           | ExamPage, FlashcardStudy, SRS Review, AI Coach chat |

Light mode = editorial sáng (cream / off-white surface, accent đậm). Dark mode = luxury (oklch surface đen ấm, không xanh-than thường gặp). Cả hai đều phải **deliberate**, không phải "đảo invert".

#### Color palette (oklch tokens)

```css
:root {
  /* Surfaces — editorial light */
  --color-bg: oklch(98.5% 0.005 90); /* warm cream */
  --color-surface: oklch(100% 0 0);
  --color-surface-2: oklch(96% 0.008 85); /* paper card */
  --color-ink: oklch(18% 0.01 60); /* near-black warm */
  --color-ink-soft: oklch(38% 0.015 60);

  /* Brand — "Brain Gym" muscle + neuron */
  --color-accent: oklch(64% 0.19 28); /* terracotta (effort) */
  --color-accent-strong: oklch(54% 0.22 28);
  --color-signal: oklch(72% 0.17 165); /* neuron mint (mastered) */
  --color-warn: oklch(78% 0.16 75); /* amber (review due) */
  --color-danger: oklch(58% 0.22 25);

  /* Data viz — dùng cho domain proficiency */
  --viz-1: oklch(64% 0.19 28);
  --viz-2: oklch(70% 0.14 195);
  --viz-3: oklch(74% 0.16 145);
  --viz-4: oklch(68% 0.18 305);
  --viz-5: oklch(76% 0.15 75);
}

[data-theme="dark"] {
  --color-bg: oklch(14% 0.01 60); /* warm off-black */
  --color-surface: oklch(18% 0.012 60);
  --color-surface-2: oklch(22% 0.014 60);
  --color-ink: oklch(96% 0.005 90);
  --color-accent: oklch(72% 0.18 30); /* lifted on dark */
}
```

Tất cả pairing kiểm bằng APCA Lc ≥ 75 cho body, ≥ 90 cho UI label nhỏ.

#### Typography pairing

- **Display / editorial headings**: `Fraunces` (variable, optical size) — chữ có "muscle", tốt cho tít "Pass Probability 82%".
- **UI / body**: `Inter` (variable) — neutral, dày dạn ở UI dày dữ liệu.
- **Numeric / data**: `JetBrains Mono` cho timer, score, leaderboard rank — tabular figures bắt buộc (`font-feature-settings: "tnum"`).

Tokens scale: `--text-hero: clamp(2.5rem, 1.2rem + 5vw, 5.5rem)`, `--text-display: clamp(1.75rem, 1rem + 2.5vw, 3rem)`, `--text-base: clamp(1rem, 0.94rem + 0.3vw, 1.0625rem)`.

#### Motion language

- **Editorial reveal** cho dashboard / readiness: chữ slide-up + mask, easing `cubic-bezier(0.16, 1, 0.3, 1)`, duration 350-500ms.
- **Focus mode** (exam, SRS): không có decorative motion — chỉ feedback (correct/wrong flash 120ms), tránh distraction.
- **Squad realtime**: leaderboard rank thay đổi → spring nhẹ, không bouncing quá đà.
- **Reduced motion**: tất cả transition giảm còn opacity fade 150ms; timer ring không animate, chỉ update text. Bắt buộc check `prefers-reduced-motion`.

---

### 2. User Journey Maps — 5 feature mới

#### 2.1 Question SRS Daily Review

| Bước           | Hành động                                                                        |
| :------------- | :------------------------------------------------------------------------------- |
| Persona        | The Learner (đang luyện AWS SAA, ngày 14/45)                                     |
| Entry          | Dashboard widget "12 câu đến hạn ôn hôm nay" + push notification 8h sáng         |
| 1              | Click widget → vào `/srs/today` — màn dark luxury, đếm lùi số câu còn lại        |
| 2              | Đọc câu hỏi → chọn đáp án (không có timer áp lực)                                |
| 3              | Sau khi reveal: 4 nút self-rating "Forgot / Hard / Good / Easy" (SM-2)           |
| 4              | Animation câu được "lưu vào trí nhớ dài hạn" (subtle, 1 giây) → câu tiếp         |
| 5              | Hết queue: summary "Bạn vừa khoá lại 12 câu, kế tiếp ôn ngày X"                  |
| 6              | CTA: "Tập thêm 10 câu vùng yếu" hoặc "Hết, gặp lại mai"                          |
| Pain points    | (a) User skip ngày → backlog phình; (b) self-rating bias; (c) cảm giác lặp       |
| Delight        | "Memory streak" tăng khi review đúng giờ; visualisation forgetting curve cá nhân |
| Retention hook | Email/push: "Nếu bỏ hôm nay, 8 câu sẽ tụt về Learning. Mất 6 phút thôi."         |

#### 2.2 Exam Readiness Dashboard (Pass Predictor)

| Bước           | Hành động                                                                 |
| :------------- | :------------------------------------------------------------------------ |
| Persona        | The Learner — đã làm 600+ câu, chuẩn bị book lịch thi                     |
| Entry          | Tab "Readiness" trên Dashboard hoặc deep-link sau khi finish exam attempt |
| 1              | Hero: gauge số lớn "82% chance of passing AWS SAA" + delta tuần           |
| 2              | Bento dưới: 6 domain bars (proficiency %, target %), badge weak/strong    |
| 3              | Section "Vs top 10% candidates" — radar chart so sánh                     |
| 4              | Recommendation card: "Focus 3 ngày tới vào VPC + IAM Edge Cases"          |
| 5              | CTA: "Start targeted drill" → Adaptive Weakness session                   |
| 6              | Optional: "Book exam with confidence" — link vendor + checklist 24h       |
| Pain points    | (a) % nhảy mạnh sau 1 lần làm tệ → user hoảng; (b) mô hình black-box      |
| Delight        | Trend line lên đều — feedback rõ ràng; "Why?" tooltip giải thích model    |
| Retention hook | Notification khi readiness ≥ 80% kéo dài 7 ngày: "Bạn sẵn sàng rồi"       |

#### 2.3 Behavioral Insights & Burnout Micro-break

| Bước           | Hành động                                                                      |
| :------------- | :----------------------------------------------------------------------------- |
| Persona        | The Learner — làm exam 60 phút, response time variance tăng                    |
| Entry          | Trong exam: AI detect drift (response time σ tăng > threshold, accuracy giảm)  |
| 1              | Banner non-blocking trên đỉnh: "Bạn đang giảm tốc. 90 giây nghỉ?" + "Tiếp tục" |
| 2              | User chọn micro-break → overlay full-screen, dim, breathing circle 4-7-8       |
| 3              | Timer dừng (chế độ Lenient) HOẶC vẫn chạy (Strict) — clearly labeled           |
| 4              | Resume → quay lại câu đang làm, 2 giây countdown trước khi tương tác lại       |
| 5              | Sau exam: insights tab "You slowed down at Q42. Pattern: 60-min wall"          |
| 6              | Suggestion: "Next session, tập 'time-pressure resistance' module"              |
| Pain points    | (a) False positive làm phiền; (b) interrupt trong câu khó = bực                |
| Delight        | Insights mang tính coach, không judging; data viz đẹp, không số khô            |
| Retention hook | Weekly digest email "Brain pattern of the week"                                |

#### 2.4 Training Squads (Social + Realtime Leaderboard)

| Bước           | Hành động                                                                      |
| :------------- | :----------------------------------------------------------------------------- |
| Persona        | The Squad Lead + 5-10 Learners cùng target AZ-104                              |
| Entry          | Invite link / discover → "Join squad" CTA trên Leaderboard                     |
| 1              | Squad Hub: bento — squad name, member avatars, weekly target progress          |
| 2              | Realtime leaderboard (WebSocket): rank thay đổi khi member submit              |
| 3              | Activity feed: "Lan vừa pass mock exam 78%", "Hùng streak day 21"              |
| 4              | Weekly Challenge card: "Tổng 500 câu trước CN" — progress bar tập thể          |
| 5              | Peer Review queue: review explanation của member khác → earn badge             |
| 6              | DM/comments inline (lightweight, không phải full chat app)                     |
| Pain points    | (a) Squad chết → user nản; (b) toxicity / spam; (c) social anxiety bị xếp cuối |
| Delight        | "Personal best" highlight ngay cả khi không top — celebrate effort             |
| Retention hook | Squad lead nudge tự động khi member im lặng > 3 ngày                           |

#### 2.5 AI Coach 1-1 Chat

| Bước           | Hành động                                                                |
| :------------- | :----------------------------------------------------------------------- |
| Persona        | The Learner — vừa fail mock exam, không biết học gì tiếp                 |
| Entry          | Floating "Ask Coach" button (nav rail) hoặc "Get advice" sau exam result |
| 1              | Chat panel mở (slide-in từ phải, không full-page) — dark luxury          |
| 2              | Coach mở đầu với context: "Tôi thấy bạn vừa làm SAA mock — 62%. Hỏi gì?" |
| 3              | Quick prompts: "Giải thích Q12", "Lập kế hoạch 7 ngày", "Vùng yếu nhất?" |
| 4              | User chat — coach trả lời streaming, có cite vào câu hỏi / domain cụ thể |
| 5              | Action chips: "Tạo drill 20 câu" / "Lên lịch SRS" — coach actionable     |
| 6              | Lưu conversation; resume sau; export plan ra Dashboard                   |
| Pain points    | (a) Hallucination; (b) generic advice; (c) latency >3s = mất flow        |
| Delight        | Coach nhớ context user, dùng số liệu thật, đề xuất ngắn gọn actionable   |
| Retention hook | Daily check-in proactive (opt-in): "Hôm nay tập 20' VPC nhé?"            |

---

### 3. Information Architecture update

**Hiện tại** (suy ra từ `src/pages/`): Dashboard, ExamLibrary, ExamPage, FlashcardDecks, FlashcardStudy, StudyMode, TrainingHub, TrapQuestionsPage, Leaderboard, QuestionsBrowser, AiQuestionGenerator, Auth + admin/org routes.

**Vấn đề**: TrainingHub, StudyMode, FlashcardDecks, ExamLibrary có overlap mục đích — user mới sẽ lạc.

**Restructure đề xuất** (3 trục chính):

```
/                   → Dashboard (Bento: streak, due reviews, readiness, squad)
/train              → Training Hub (gộp StudyMode + Adaptive Drill + SRS daily)
  /train/srs        → SRS Daily Review (NEW)
  /train/drill/:id  → Adaptive weakness drill
  /train/flashcards → Flashcards (giữ nguyên)
/exam               → Exam (Library + Builder + Attempt + Result)
/readiness          → Pass Predictor (NEW)
/squad              → Training Squads (NEW)
  /squad/:id
/coach              → AI Coach (overlay, không phải route riêng)
/library            → Questions, Trap Questions, Decks (read-only browse)
/me                 → Profile, Streak, Behavioral Insights (NEW), Settings
```

#### Onboarding 7 ngày đầu

| Day | Mục tiêu                               | Trigger             |
| :-- | :------------------------------------- | :------------------ |
| 0   | Pick 1 cert + lý do thi                | Modal sau signup    |
| 0   | Diagnostic 15 câu → readiness baseline | Dashboard CTA chính |
| 1   | First SRS review (chỉ 5 câu)           | Push 8h sáng        |
| 2   | First adaptive drill (vùng yếu nhất)   | Email nudge         |
| 3   | Tour Trap Question Library             | In-app coach mark   |
| 4   | First mock 30 câu                      | Dashboard banner    |
| 5   | Suggest join Squad                     | Sau khi finish mock |
| 7   | Weekly review + AI Coach intro         | Email digest        |

Skippable nhưng có progress bar 7 dots ở top — Zeigarnik effect kéo user quay lại.

---

### 4. Component design system tasks

**Components mới cần thêm** (shadcn/ui base + custom):

| Component              | Mục đích                          | Notes                                         |
| :--------------------- | :-------------------------------- | :-------------------------------------------- |
| `<ReadinessGauge>`     | Số lớn + arc + delta              | SVG, không dùng canvas; tabular figures       |
| `<DomainBentoCard>`    | Một ô bento cho 1 domain          | Variants: weak/balanced/strong                |
| `<SrsRatingBar>`       | 4 nút Forgot/Hard/Good/Easy       | Keyboard 1-4, large hit area 48px             |
| `<SquadRankRow>`       | Row leaderboard có realtime delta | Animate rank change (reduced-motion safe)     |
| `<CoachChat>`          | Slide-in panel chat               | Streaming markdown, code block, citation chip |
| `<MicroBreakOverlay>`  | Full-screen breathing             | Reduced-motion: static text + countdown       |
| `<ForgettingCurve>`    | Visualisation cá nhân             | Recharts hoặc custom SVG                      |
| `<StreakRing>`         | Ring + flame                      | Đã có `streak.store`, chỉ thêm visual         |
| `<ActivityFeedItem>`   | Squad feed                        | Polymorphic: rank/badge/comment               |
| `<AnnouncementBanner>` | Burnout nudge non-blocking        | aria-live=polite                              |

**Tokens cần thêm**:

- Spacing rhythm: `--space-bento-gap`, `--space-section`, `--space-card-pad-tight/normal/loose` (3 rhythm chứ không 1).
- Radius: `--radius-card: 16px`, `--radius-pill: 999px`, `--radius-sharp: 4px` (editorial cần sharp).
- Elevation: `--shadow-paper`, `--shadow-floating`, `--shadow-focus-ring` (focus indicator riêng).
- Z-layer: explicit token cho overlay / coach panel / toast / micro-break (tránh chiến tranh z-index).
- Motion duration: `--dur-instant 90ms`, `--dur-fast 150ms`, `--dur-base 240ms`, `--dur-slow 420ms`.
- Data viz: `--viz-1..5` đã định nghĩa ở trên — pin vào docs để dev không tự chế màu.

---

## Phần B — QA Strategy

### 5. Test pyramid hiện tại + target

**Hiện tại**: Vitest unit (FE), Jest (BE), Playwright e2e mới sơ khai (theo recent commit `Add e2e test`). **Chưa có** visual regression, a11y automation, perf gate.

| Tầng                   | Tỉ lệ target | Tooling                           | Coverage gate                        |
| :--------------------- | :----------- | :-------------------------------- | :----------------------------------- |
| Unit                   | ~65%         | Vitest + Testing Library          | ≥ 80% lines, ≥ 75% branches          |
| Integration (API + DB) | ~20%         | Jest (NestJS) + supertest         | ≥ 80% controllers/services           |
| E2E (critical flow)    | ~8%          | Playwright (Chromium + WebKit)    | 100% golden path qua trước merge     |
| Visual regression      | ~4%          | Playwright screenshots + reg-cli  | 0 unintended diff trên 4 breakpoints |
| Accessibility          | ~2%          | axe-core + Playwright + manual SR | 0 critical/serious axe violation     |
| Performance            | ~1%          | Lighthouse CI                     | LCP/INP/CLS theo bảng §8             |

Tổng coverage threshold (line+branch+func) tối thiểu **80%** — match `~/.claude/rules/common/testing.md`.

---

### 6. Test plan cho 5 feature mới

#### 6.1 Question SRS Daily Review

| Loại     | Cases                                                                                                                                                        |
| :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Golden   | Login → có 12 câu due → review xong → counter = 0 → schedule cập nhật                                                                                        |
| Edge     | (a) 0 câu due (empty state); (b) 500 câu backlog (perf + UX); (c) skip 14 ngày; (d) đổi timezone giữa session; (e) DST shift; (f) submit khi offline → queue |
| A11y     | Keyboard 1-4 cho rating, focus visible, SR announce "Question 3 of 12", reduced-motion                                                                       |
| Perf     | TTFB queue API < 300ms; bundle riêng cho SRS route < 60kb gz                                                                                                 |
| Security | Không leak câu trả lời trong response trước khi user reveal; rate-limit submit; userId scope chặt                                                            |

#### 6.2 Exam Readiness Dashboard

| Loại     | Cases                                                                                                                                       |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| Golden   | User có ≥ 100 attempts → gauge render → drill-down domain → CTA hoạt động                                                                   |
| Edge     | (a) < 30 attempts → "need more data" state; (b) model 0% / 100% (clamp); (c) 2 cert song song không lẫn                                     |
| A11y     | Gauge có `role="img"` + `aria-label="82% pass probability"`; bảng domain có `<caption>`; data viz colorblind-safe (palette test với Coblis) |
| Perf     | Initial paint readiness < 2.5s; recompute server-side, cache 5 min                                                                          |
| Security | Model output không expose raw user data của user khác trong "vs top 10%"                                                                    |

#### 6.3 Behavioral Insights & Micro-break

| Loại     | Cases                                                                                                                          |
| :------- | :----------------------------------------------------------------------------------------------------------------------------- |
| Golden   | Detect drift → banner xuất hiện → user accept break → resume đúng câu                                                          |
| Edge     | (a) Strict mode: timer không pause, label rõ; (b) decline 3 lần liên tiếp → tăng threshold; (c) network blip giữa break        |
| A11y     | Banner `aria-live=polite`, không trap focus; overlay có Esc thoát; reduced-motion thay breathing animation bằng text countdown |
| Perf     | Telemetry không block UI (sendBeacon); detection chạy worker hoặc throttled                                                    |
| Security | Telemetry không gửi nội dung câu hỏi; chỉ metadata (timing, idx)                                                               |

#### 6.4 Training Squads (Realtime)

| Loại     | Cases                                                                                                                                     |
| :------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| Golden   | Join squad → submit attempt → leaderboard update < 2s tới các thành viên khác                                                             |
| Edge     | (a) WebSocket disconnect → fallback polling + reconcile; (b) 50 member squad (perf); (c) member rời giữa challenge; (d) timezone hiển thị |
| A11y     | Realtime change announce qua `aria-live=polite` (không spam); rank delta có text alternative ngoài màu                                    |
| Perf     | WS payload < 2KB/event; rate limit 1 update/s/squad/client                                                                                |
| Security | RBAC: chỉ member thấy DM; moderation hook cho activity feed; XSS sanitisation cho explanation peer review                                 |

#### 6.5 AI Coach Chat

| Loại     | Cases                                                                                                                                                                            |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Golden   | User hỏi "vùng yếu" → coach trả về có cite domain + CTA tạo drill → drill được tạo                                                                                               |
| Edge     | (a) LLM timeout > 10s → graceful retry; (b) prompt injection ("ignore previous"); (c) user dán PII; (d) rate limit; (e) streaming bị cắt giữa chừng                              |
| A11y     | Streaming text có `aria-live=polite`; scroll lock không cản SR; markdown render giữ heading hierarchy                                                                            |
| Perf     | Time-to-first-token < 1.2s; full response < 6s p95                                                                                                                               |
| Security | (1) Server-side prompt template, không trust client system prompt; (2) PII redaction trước khi log; (3) Output filter (no exam answer key dump); (4) cost guardrail per user/day |

---

### 7. A11y roadmap (WCAG 2.2 AA)

#### Top 10 a11y gap suy đoán + cách verify

| #   | Gap suy đoán                                                         | Verify                                                         |
| :-- | :------------------------------------------------------------------- | :------------------------------------------------------------- |
| 1   | ExamPage timer chỉ thay đổi màu khi gần hết → fail SC 1.4.1          | Test colorblind sim + thêm icon + text "5:00 left"             |
| 2   | Mark-for-review có thể là icon-only — no aria-label                  | NVDA/VoiceOver smoke test, assert accessible name              |
| 3   | Modal exam confirm submit có thể không trap focus đúng               | Keyboard tab cycle test (Playwright)                           |
| 4   | Flashcard flip dùng transform-only → SR không biết "đã lật"          | Inject `aria-pressed` + announce mặt sau                       |
| 5   | Dashboard charts thiếu text alternative                              | axe-core + manual: mỗi chart có `<figcaption>` hoặc data table |
| 6   | Color-only indicator weak/strong domain                              | Thêm icon + label, contrast 3:1 cho UI graphic                 |
| 7   | Page transition Framer Motion không respect `prefers-reduced-motion` | Test với OS reduced motion ON, expect no transform             |
| 8   | Touch target < 24×24 (icon nav, rating buttons)                      | Audit script đo `getBoundingClientRect`; SC 2.5.8              |
| 9   | Form lỗi chỉ đỏ, không message bên dưới                              | RHF + Zod render `<p role="alert">`; SC 3.3.1, 3.3.3           |
| 10  | Exam timer auto-submit không cảnh báo trước (SC 2.2.1)               | "1 phút còn lại" announce + tuỳ chọn extend (Lenient mode)     |

#### A11y test automation setup

```ts
// tests/a11y/exam.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("ExamPage has no critical a11y violations", async ({ page }) => {
  await page.goto("/exam/aws-saa");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  const critical = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(critical).toEqual([]);
});
```

- Gate CI: 0 critical/serious axe violation trên 8 page chính.
- Manual SR smoke (NVDA + VoiceOver) checklist cho mỗi release.
- Storybook + `@storybook/addon-a11y` cho component-level.

---

### 8. Performance budgets

| Page type             | LCP    | INP   | CLS  | FCP  | TBT   | JS gz            | CSS gz |
| :-------------------- | :----- | :---- | :--- | :--- | :---- | :--------------- | :----- |
| Auth / landing        | 2.0s   | 150ms | 0.05 | 1.2s | 150ms | 120 KB           | 25 KB  |
| Dashboard / Readiness | 2.5s   | 200ms | 0.10 | 1.5s | 200ms | 220 KB           | 40 KB  |
| ExamPage (focus)      | 2.0s   | 150ms | 0.05 | 1.3s | 150ms | 180 KB           | 30 KB  |
| Squad realtime        | 2.5s   | 200ms | 0.10 | 1.5s | 200ms | 200 KB           | 35 KB  |
| AI Coach panel        | (lazy) | 200ms | 0.05 | —    | 200ms | +60 KB on-demand | +10 KB |

#### Lighthouse CI gate

- Performance ≥ 85 cho route quan trọng, ≥ 90 cho landing.
- Accessibility ≥ 95 mọi route.
- Best practices ≥ 95.
- Block PR nếu fail 2 lần liên tiếp.
- Bundle analyzer chạy mỗi PR, comment diff size.

#### Tactic chính

- Code-split AI Coach + Recharts + Framer Motion.
- Preload font 1 weight; rest swap.
- IntersectionObserver cho dashboard widgets — không mount hết một lúc.
- WebSocket lazy connect (chỉ khi vào /squad).

---

### 9. Visual regression strategy

**Tool**: Playwright screenshots + `toHaveScreenshot()` built-in (đủ dùng, không cần Percy giai đoạn này).

**Pages cần screenshot**:

| Page              | Breakpoints          | States                                            |
| :---------------- | :------------------- | :------------------------------------------------ |
| Dashboard         | 320, 768, 1024, 1440 | Empty / Active / Lots-of-data                     |
| Readiness         | 768, 1440            | < 30 attempts / Normal / Ready ≥ 80%              |
| ExamPage          | 768, 1440            | Intro / In-progress / Marked / Last 5min / Result |
| FlashcardStudy    | 320, 1024            | Front / Back / Empty                              |
| Squad Hub         | 768, 1440            | Empty / Active / Realtime delta                   |
| AI Coach panel    | 320, 1024            | Empty / Streaming / Error                         |
| TrapQuestionsPage | 768, 1440            | Default                                           |
| Leaderboard       | 768, 1440            | Default                                           |

Mỗi state × **2 themes** (light + dark) × Chromium + WebKit. Tổng ~ 250 baseline.

**Quy ước**:

- Mock thời gian (`page.clock.install()`), seed data deterministic.
- Disable animation trong test (`prefers-reduced-motion: reduce` + `animation-duration: 0`).
- Tolerance pixel 0.1%, max diff pixels 100.
- Baseline lưu trong `tests/visual/__screenshots__/`, review qua PR review (yêu cầu reviewer xác nhận).

---

### 10. Bug triage & quality gates

#### Severity & SLA

| Severity      | Định nghĩa                                                | Ví dụ                                | SLA fix    | Release block            |
| :------------ | :-------------------------------------------------------- | :----------------------------------- | :--------- | :----------------------- |
| S0 — Critical | Mất dữ liệu, lộ data, exam không submit được, auth bypass | Submit attempt mất, JWT leak         | < 4h       | Có (hotfix)              |
| S1 — High     | Feature chính fail cho > 10% user                         | Timer reset random, SRS schedule sai | < 24h      | Có                       |
| S2 — Medium   | Feature phụ fail / a11y serious                           | Squad feed không update realtime     | < 1 tuần   | Soft (release with note) |
| S3 — Low      | Cosmetic, edge rare                                       | Spacing lệch ở 320px Squad card      | < 1 sprint | Không                    |

#### Definition of Done (QA view)

- [ ] Unit + integration coverage ≥ 80% file mới.
- [ ] E2E golden path xanh trên Chromium + WebKit.
- [ ] 0 critical/serious axe violation trên route mới.
- [ ] Visual regression baseline approved.
- [ ] Lighthouse perf không regress > 5 điểm vs main.
- [ ] Bundle size không vượt budget (§8).
- [ ] Manual SR smoke 1 lần (NVDA hoặc VoiceOver).
- [ ] Reduced-motion verified.
- [ ] Security checklist: input validation, RBAC, rate-limit, secret scan clean.
- [ ] No console.log / debug code.
- [ ] Docs cập nhật (component story, API contract).
- [ ] Feature flag mặc định OFF khi merge, bật theo cohort.

#### Release criteria

- All S0/S1 closed.
- ≤ 3 S2 open (with mitigation note).
- Canary 5% traffic 24h không tăng error rate > 0.5%.
- Rollback plan ghi rõ trong PR description.

---

> **Nguyên tắc tổng**: Brain Gym phải cho user cảm giác "tôi đang khoẻ lên mỗi ngày" — nên UX không được template, QA không được lơi. Mỗi feature mới đi qua đủ pyramid + a11y gate + perf budget trước khi gọi là Done.
