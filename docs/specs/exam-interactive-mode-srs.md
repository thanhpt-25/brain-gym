# SRS — Exam Interactive Mode (phản hồi đúng/sai + giải thích sau từng câu)

| | |
|---|---|
| **Tài liệu** | Software Requirements Specification (SRS) + kế hoạch triển khai & kiểm thử |
| **Tính năng** | Chế độ thi **Interactive**: sau mỗi câu, người dùng biết ngay câu trả lời đúng hay sai và đọc được giải thích chi tiết |
| **Phiên bản** | 1.0 (Đã chốt D1–D6) |
| **Ngày** | 2026-09-25 |
| **Trạng thái** | Đã triển khai |
| **Phụ thuộc** | Không (dùng lại `Question.explanation`, `AttemptsService`, `MarkdownContent` đã có) |
| **Module liên quan** | `attempts`, `exam-catalog` (backend) · `ExamPage.tsx`, `components/exam/*`, `ExamShare.tsx`, `ExamLibrary.tsx` (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Hiện tại luồng thi (`/exam/:certId`) chỉ cho người dùng biết kết quả khi bấm **Submit** hoặc hết giờ. Với mục đích *luyện tập*, người học muốn biết ngay mình sai ở đâu và vì sao, khi ngữ cảnh câu hỏi còn đang trong đầu. Tài liệu này đặc tả **Interactive Mode**:

1. Sau mỗi câu, người dùng bấm **Check answer** → hệ thống báo **Đúng / Sai**, tô màu đáp án đúng và đáp án đã chọn.
2. Hiển thị **giải thích chi tiết** (`Question.explanation`, markdown) ngay dưới câu hỏi.
3. Chế độ mặc định hiện tại (chỉ chấm khi kết thúc) được giữ nguyên và gọi là **Exam Mode**.

### 1.2. Phạm vi

**Trong phạm vi:**
- Enum `FeedbackMode` + field `ExamAttempt.feedbackMode`; field `Answer.checkedAt` để khoá câu đã xem đáp án.
- `POST /exams/:examId/start` nhận tuỳ chọn `feedbackMode`.
- API mới `POST /attempts/:id/check` — chấm một câu, trả đúng/sai + đáp án đúng + giải thích.
- `submit()` tôn trọng các câu đã khoá (không cho sửa đáp án sau khi đã xem lời giải).
- Frontend: chọn chế độ ở `ExamIntro` (và `ExamShare`, D4), panel phản hồi trong `ExamSession`, trạng thái đúng/sai trên Question Navigator.
- Unit test, component test, E2E test và checklist hồi quy (§8, §9).

**Ngoài phạm vi:**
- Luồng Training (`PracticeSession`, Weakness/Daily Review) — đã có reveal riêng, không đổi.
- Bài thi của tổ chức (`/org/:slug` catalog, assignment) và Candidate Assessment (`/take/:token`) — **luôn** là Exam Mode, không có Interactive (tránh lộ đáp án trong bài đánh giá).
- Resume bài thi sau khi refresh (hiện chưa hỗ trợ ở cả hai chế độ).
- AI giải thích bổ sung khi câu hỏi không có `explanation` (có thể làm sau).
- Chế độ "Study" chỉ xem đáp án không cần trả lời (đã có `StudyMode.tsx`).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| **Exam Mode** (`END_OF_EXAM`) | Hành vi hiện tại: chỉ chấm và hiển thị kết quả sau khi submit |
| **Interactive Mode** (`INTERACTIVE`) | Chấm từng câu ngay khi người dùng bấm *Check answer* |
| **Check** | Hành động xác nhận đáp án cho một câu trong Interactive Mode; sau khi check, câu đó bị **khoá** |
| **Locked answer** | `Answer` có `checkedAt != null` — không được sửa lựa chọn nữa |
| **Feedback panel** | Khối UI hiện kết quả Đúng/Sai + giải thích dưới câu hỏi |

### 1.4. Hiện trạng (đã khảo sát code)

- `ExamPage.tsx` giữ `answers` trong state cục bộ; chỉ gọi `POST /attempts/:id/submit` khi submit/hết giờ. Có 3 cách vào phase `exam`:
  1. `ExamIntro` → `createExam()` → `startAttempt()` (luyện theo certification).
  2. `ExamLibrary.tsx` / `ExamShare.tsx` gọi `startAttempt()` rồi `navigate(/exam/:certId, { state: { attemptData } })` — **bỏ qua** `ExamIntro`.
  3. `OrgExamCatalog.tsx` → `startCatalogExam()` (backend `exam-catalog.service.ts`, tự tạo `ExamAttempt`, không đi qua `AttemptsService.start`).
- `AttemptsService.start()` trả câu hỏi **không** có `isCorrect` / `explanation`; choice được shuffle và relabel a–d theo vị trí.
- `AttemptsService.submit()` xoá toàn bộ `Answer` của attempt rồi tạo lại từ payload (`evaluateAnswers`) — thứ tự theo payload, chống trùng `questionId`, tự thêm câu thiếu.
- `POST /attempts/:id/answer` (`saveAnswer`) đã tồn tại, dùng bởi `PracticeSession`; tính `isCorrect` và upsert `Answer`. **Không** kiểm tra `questionId` có thuộc exam của attempt hay không.
- `Question.explanation String?` đã có; `ExamResult.tsx` và `PracticeSession.tsx` đã render nó bằng `MarkdownContent`.
- `ExamSession.tsx` là component thuần hiển thị (props từ `ExamPage`), có Question Navigator với 3 trạng thái Answered / Flagged / Unanswered.

---

## 2. Mô tả tổng quan

### 2.1. Luồng chính (Interactive)

```
User (ExamIntro)                  Frontend (ExamPage)                    Backend
  chọn Feedback = Interactive ─►  createExam() + startAttempt(examId,
                                    { feedbackMode: INTERACTIVE }) ──►  ExamAttempt.feedbackMode = INTERACTIVE
                                                                        trả câu hỏi (không có isCorrect/explanation)
  chọn đáp án câu 1           ─►  answers[q1] = [c2]   (chưa gọi API)
  bấm "Check answer"          ─►  POST /attempts/:id/check {q1,[c2]} ─► kiểm tra quyền + câu thuộc exam + chưa khoá
                                                                        upsert Answer(isCorrect, checkedAt=now)
                                  ◄──────────────────────────────────── { isCorrect, correctChoiceIds, explanation }
  thấy ✓/✗ + giải thích       ◄─  feedback[q1] = ...; choices bị disable
  ... lặp lại ...
  bấm Submit / hết giờ        ─►  POST /attempts/:id/submit (như cũ)  ─► câu đã khoá: dùng đáp án đã lưu (bỏ qua payload)
                                                                        câu chưa check: chấm từ payload như cũ
  ExamResult (như cũ)         ◄──────────────────────────────────────── AttemptResult
```

### 2.2. Vòng đời một câu hỏi trong Interactive Mode

```
UNANSWERED ──chọn──► ANSWERED (đổi được) ──Check──► CHECKED_CORRECT | CHECKED_INCORRECT (khoá)
     │                     │
     └───────── Submit / hết giờ: câu chưa check được chấm như Exam Mode ─────────┘
```

### 2.3. Nhóm người dùng

| Actor | Quyền trong tính năng |
|---|---|
| Người dùng đã đăng nhập (mọi role) | Chọn Interactive khi bắt đầu bài thi cá nhân; check câu trong attempt của chính mình |
| Thành viên tổ chức (catalog / assignment) | Không có lựa chọn — luôn Exam Mode |
| Ứng viên Candidate Assessment | Không áp dụng (luồng `/take/:token` riêng) |

---

## 3. Yêu cầu chức năng

### FR-1 — Data model

```prisma
enum FeedbackMode {
  END_OF_EXAM
  INTERACTIVE
}

model ExamAttempt {
  // ... giữ nguyên các field hiện có
  feedbackMode FeedbackMode @default(END_OF_EXAM) @map("feedback_mode")
}

model Answer {
  // ... giữ nguyên các field hiện có
  /// Thời điểm người dùng xem đáp án (Interactive Mode). Khác null ⇒ câu bị khoá.
  checkedAt DateTime? @map("checked_at")
}
```

- Migration chỉ **thêm cột** có default / nullable → dữ liệu cũ hợp lệ, mọi attempt cũ là `END_OF_EXAM`.
- Chọn attempt-level (không phải exam-level như `timerMode`) vì cùng một exam (VD exam public trong Library) có thể được người này thi Interactive, người khác thi Exam Mode (D1).

### FR-2 — Bắt đầu attempt với `feedbackMode`

`POST /exams/:examId/start` nhận body tuỳ chọn:

```ts
class StartAttemptDto {
  @IsOptional() @IsEnum(FeedbackMode)
  feedbackMode?: FeedbackMode; // mặc định END_OF_EXAM
}
```

- Body rỗng / thiếu field → `END_OF_EXAM` (tương thích ngược với `ExamLibrary`, `ExamShare`, e2e cũ).
- Giá trị không hợp lệ → `400`.
- Nếu `exam.timerMode === TIME_PRESSURE` và client gửi `INTERACTIVE` → `400 "Interactive mode is not available for Time Pressure exams"` (D3).
- Response `StartAttemptResponse` bổ sung `feedbackMode`. Câu hỏi vẫn **không** chứa `isCorrect` / `explanation`.
- `exam-catalog.service.ts#startCatalogExam` và `training.service.ts` không đổi: attempt tạo ra nhận default `END_OF_EXAM`; response catalog bổ sung `feedbackMode: 'END_OF_EXAM'` để frontend đọc nhất quán.

### FR-3 — API check từng câu

`POST /attempts/:id/check` (JWT) — body `SubmitAnswerDto` hiện có (`questionId`, `selectedChoices`, `isMarked?`).

**Kiểm tra theo thứ tự:**

| # | Điều kiện | Lỗi |
|---|---|---|
| C1 | Attempt tồn tại | 404 |
| C2 | `attempt.userId === req.user.id` | 403 |
| C3 | `attempt.status === IN_PROGRESS` | 400 `Attempt already submitted` |
| C4 | `attempt.feedbackMode === INTERACTIVE` | 403 `Interactive feedback is not enabled for this attempt` |
| C5 | `questionId` thuộc `exam.examQuestions` của attempt | 400 `Question is not part of this exam` |
| C6 | `selectedChoices` không rỗng và mọi id thuộc `question.choices` | 400 |
| C7 | Chưa có `Answer` với `checkedAt != null` cho câu này | 409 `Answer already checked` |

**Xử lý:** tính `isCorrect` (cùng công thức `evaluateAnswers`, tách ra helper dùng chung `isAnswerCorrect(correctIds, selected)`), upsert `Answer` với `checkedAt = now()`, `questionOrder` như `saveAnswer`. Chống race hai request check song song cho cùng câu: thực hiện trong `$transaction` và điều kiện update `checkedAt: null` (updateMany count = 0 ⇒ 409).

**Response `200`:**

```ts
interface CheckAnswerResponse {
  questionId: string;
  isCorrect: boolean;
  selectedChoiceIds: string[];
  correctChoiceIds: string[];
  explanation: string | null;   // markdown, render bằng MarkdownContent (đã sanitize)
  checkedAt: string;            // ISO
}
```

- Không trả `label` của choice (label đã được relabel theo vị trí ở `start()`); frontend map theo `id`.
- Throttle: dùng default throttler của app (không `@SkipThrottle`) — mỗi câu chỉ check được 1 lần nên lưu lượng tự nhiên thấp.

### FR-4 — Submit / Finish với câu đã khoá

- `submit()`: đọc các `Answer` có `checkedAt != null` của attempt **trước** khi xoá. Trong `evaluateAnswers`, với câu đã khoá: bỏ qua `selectedChoices` trong payload, dùng `selectedChoices` + `isCorrect` + `checkedAt` đã lưu. `isMarked` vẫn lấy từ payload (flag không ảnh hưởng điểm).
- Thứ tự `questionOrder` vẫn theo payload như hiện tại (không đổi hành vi review).
- Câu chưa check (kể cả trong Interactive) chấm từ payload như Exam Mode.
- `finish()` không đổi (đã dùng answers đã lưu).
- Với attempt `END_OF_EXAM` luồng submit **không đổi gì** (không có answer nào có `checkedAt`).

### FR-5 — `saveAnswer` không được ghi đè câu đã khoá

`POST /attempts/:id/answer` trên câu đã có `checkedAt` → `409 Answer already checked`. (Không ảnh hưởng `PracticeSession` vì attempt training không bao giờ có `checkedAt`.)

### FR-6 — Kết quả & lịch sử

- `AttemptResultResponse` và item của `GET /attempts/me` bổ sung `feedbackMode`.
- `QuestionResultResponse` bổ sung `checkedAt?` (để sau này phân tích "đã xem lời giải giữa bài").
- `ExamResult.tsx` hiển thị badge nhỏ "Interactive" cạnh điểm khi `feedbackMode === INTERACTIVE`; phần review câu hỏi giữ nguyên.
- Điểm, domain breakdown, gamification (`COMPLETE_EXAM`), `attemptCount`, `avgScore` tính như cũ (D5).

### FR-7 — Frontend: chọn chế độ

- `ExamIntro.tsx`: thêm nhóm **Feedback** dưới *Timer Mode* với 2 lựa chọn dạng nút giống timer mode:
  - **Exam** — "Kết quả hiển thị khi nộp bài" (mặc định).
  - **Interactive** — "Xem đúng/sai và giải thích sau mỗi câu".
- Khi chọn Timer `TIME_PRESSURE`, nút Interactive bị disable kèm tooltip, và nếu đang chọn Interactive thì tự chuyển về Exam.
- `ExamPage.startExam()` truyền `feedbackMode` vào `startAttempt(exam.id, { feedbackMode })`.
- `services/attempts.ts#startAttempt(examId, opts?)` — tham số thứ hai tuỳ chọn, gọi cũ vẫn hợp lệ.
- `ExamShare.tsx`: thêm toggle Exam / Interactive cạnh nút Start (D4). `ExamLibrary.tsx`: giữ nguyên (Exam Mode) trong v1.
- Lựa chọn gần nhất được nhớ trong `localStorage` key `exam.feedbackMode` (bọc try/catch; lỗi ⇒ mặc định Exam).

### FR-8 — Frontend: phiên thi Interactive (`ExamSession.tsx`)

State mới trong `ExamPage`: `feedback: Record<questionId, CheckAnswerResponse>`, `checkingId: string | null`.

Khi `attemptData.feedbackMode === "INTERACTIVE"`:

1. Dưới danh sách lựa chọn có nút **Check answer** — disable khi chưa chọn đáp án hoặc đang gọi API. Câu SINGLE cũng **không** tự check khi click (D6).
2. Sau khi check thành công:
   - Các nút choice bị `disabled`; `selectAnswer` bỏ qua câu đã có `feedback` (chặn cả ở `ExamPage`, không chỉ UI).
   - Choice đúng: viền/nền `accent` + ✓; choice đã chọn nhưng sai: `destructive` + ✗; choice còn lại: muted. Dùng cùng quy ước màu với `ExamResult`.
   - **Feedback panel**: icon `CheckCircle2`/`XCircle`, tiêu đề "Correct!" / "Incorrect", dòng "Correct answer: B, D" (label hiển thị theo thứ tự đang thấy), và `<MarkdownContent>{explanation}</MarkdownContent>`; nếu `explanation` rỗng: "No explanation available for this question yet."
   - Panel có `role="status"` + `aria-live="polite"` để screen reader đọc kết quả; focus chuyển tới tiêu đề panel.
   - Nút **Check answer** đổi thành **Next question** (primary) để sang câu tiếp theo (D6). Ở câu cuối, nút đổi thành **Finish exam** và mở cùng luồng Submit hiện có.
3. Lỗi mạng khi check → toast "Could not check answer. Please try again.", câu vẫn ở trạng thái ANSWERED, cho thử lại. `409` → toast "This answer was already checked" (chỉ xảy ra nếu request bị gửi lặp; nút Check đã bị disable trong lúc gọi API).
4. Question Navigator thêm 2 trạng thái (chỉ trong Interactive): **Correct** (`bg-accent`) và **Incorrect** (`bg-destructive/20 text-destructive`); legend cập nhật tương ứng. Ưu tiên hiển thị: Current > Flagged > Checked > Answered > Unanswered.
5. Top bar hiển thị bộ đếm live `✓ n · ✗ m` (số câu đã check).
6. Mark-for-review, word capture (`WordCaptureTooltip`), timer, auto-submit khi hết giờ, nút Submit — giữ nguyên.
7. Khi `feedbackMode` là `END_OF_EXAM` hoặc không có (catalog cũ), `ExamSession` render **y hệt hiện tại** — không nút Check, không panel.

---

## 4. Yêu cầu phi chức năng

| # | Yêu cầu |
|---|---|
| NFR-1 **Bảo mật** | `start` không bao giờ trả `isCorrect`/`explanation`. `check` chỉ trả dữ liệu của **một** câu thuộc exam của attempt, của chính chủ, ở Interactive Mode, và chỉ sau khi đã gửi đáp án (khoá vĩnh viễn) — không thể "dò" đáp án rồi đổi. |
| NFR-2 **Tương thích ngược** | Migration chỉ thêm cột; mọi API cũ giữ nguyên contract khi không truyền field mới. Client cũ (không gửi `feedbackMode`) hoạt động như trước. |
| NFR-3 **Hiệu năng** | `check` p95 < 300 ms (1 truy vấn attempt + examQuestion, 1 truy vấn question+choices, 1 upsert). Không thêm truy vấn vào `start` ngoài việc ghi `feedbackMode`. |
| NFR-4 **Accessibility** | Kết quả đúng/sai không chỉ dựa vào màu (có icon + chữ); `aria-live`; điều hướng bàn phím; pass `e2e/a11y.spec.ts` (axe) hiện có. |
| NFR-5 **An toàn nội dung** | `explanation` render qua `MarkdownContent` (đã dùng `sanitizeMarkdown`), không `dangerouslySetInnerHTML`. |
| NFR-6 **Audit/Analytics** | `feedbackMode` và `checkedAt` được lưu để có thể lọc/tách Interactive khỏi các chỉ số readiness sau này. |

---

## 5. Thay đổi API (tóm tắt cho `docs/03-api_design.md`)

| Method | Path | Thay đổi |
|---|---|---|
| POST | `/exams/:examId/start` | Body tuỳ chọn `{ feedbackMode }`; response thêm `feedbackMode` |
| POST | `/attempts/:id/check` | **Mới** — chấm 1 câu (Interactive) |
| POST | `/attempts/:id/answer` | `409` nếu câu đã check |
| POST | `/attempts/:id/submit` | Câu đã check dùng đáp án đã lưu |
| GET | `/attempts/:id`, `/attempts/me` | Thêm `feedbackMode` (+ `checkedAt` trong `questionResults`) |
| POST | `/organizations/:orgId/catalog/:cid/start` | Response thêm `feedbackMode: 'END_OF_EXAM'` |

---

## 6. Tiêu chí chấp nhận (Acceptance Criteria)

| # | Given / When / Then |
|---|---|
| AC-1 | Chọn **Interactive** ở ExamIntro và bắt đầu ⇒ attempt được tạo với `feedbackMode = INTERACTIVE`; câu hỏi không chứa đáp án/giải thích trong network response. |
| AC-2 | Chọn 1 đáp án đúng rồi bấm *Check answer* ⇒ hiện "Correct!", choice được tô xanh, giải thích markdown hiển thị; navigator ô câu đó màu Correct. |
| AC-3 | Chọn đáp án sai ⇒ hiện "Incorrect", choice đã chọn tô đỏ, choice đúng tô xanh, dòng "Correct answer: …" và giải thích. |
| AC-4 | Câu MULTIPLE: chỉ đúng khi chọn đủ và không thừa đáp án (giống quy tắc chấm hiện tại). |
| AC-5 | Sau khi check, click choice khác không đổi lựa chọn; gọi `POST /check` hoặc `/answer` lần 2 cho câu đó ⇒ `409`. |
| AC-6 | Câu không có `explanation` ⇒ hiển thị "No explanation available for this question yet.", không lỗi. |
| AC-7 | Submit với payload cố tình đổi đáp án câu đã check ⇒ điểm dùng đáp án đã check. |
| AC-8 | Interactive: câu đã chọn nhưng chưa check vẫn được chấm khi submit; câu bỏ trống tính sai (như cũ). |
| AC-9 | Hết giờ ở Interactive ⇒ auto-submit như cũ, kết quả hiển thị đúng. |
| AC-10 | Attempt `END_OF_EXAM` gọi `POST /check` ⇒ `403`; UI Exam Mode không có nút Check / panel. |
| AC-11 | `POST /check` với attempt của người khác ⇒ `403`; câu không thuộc exam ⇒ `400`; attempt đã submit ⇒ `400`. |
| AC-12 | Bắt đầu từ ExamLibrary, org catalog ⇒ Exam Mode, hành vi y hệt trước. |
| AC-13 | Timer `TIME_PRESSURE` ⇒ không chọn được Interactive (UI disable, API `400`). |
| AC-14 | Trang kết quả của attempt Interactive hiển thị badge "Interactive", điểm = số câu đúng / tổng. |
| AC-15 | Screen reader đọc "Correct"/"Incorrect" sau khi check (aria-live); axe không có violation mới. |

---

## 7. Kế hoạch triển khai

Thứ tự đề xuất — mỗi bước build + test xanh trước khi sang bước sau; tất cả trong một PR (như SRS trước).

| Bước | Việc | File chính |
|---|---|---|
| 0 | Chốt D1–D6 (§10), cập nhật SRS lên v1.0 ✅ | `docs/specs/exam-interactive-mode-srs.md` |
| 1 | Schema + migration `FeedbackMode`, `ExamAttempt.feedbackMode`, `Answer.checkedAt`; `npm install` (prisma generate) | `backend/prisma/schema.prisma`, `backend/prisma/migrations/*` |
| 2 | Tách helper `isAnswerCorrect`; `StartAttemptDto`; `start()` nhận `feedbackMode` + chặn TIME_PRESSURE | `attempts.service.ts`, `attempts.controller.ts`, `dto/start-attempt.dto.ts` |
| 3 | `checkAnswer()` + route `POST /attempts/:id/check` + `CheckAnswerResponse` DTO | `attempts.service.ts`, `attempts.controller.ts`, `dto/check-answer.dto.ts` |
| 4 | `submit()` tôn trọng câu khoá; `saveAnswer()` trả 409 cho câu khoá; `findResult`/`findMyAttempts` thêm field | `attempts.service.ts`, `dto/attempt-result.dto.ts` |
| 5 | Catalog response thêm `feedbackMode` | `exam-catalog.service.ts` |
| 6 | Types + service FE: `FeedbackMode`, `CheckAnswerResponse`, `startAttempt(examId, opts?)`, `checkAnswer()` | `src/types/api-types.ts`, `src/services/attempts.ts` |
| 7 | `ExamIntro` selector + `ExamPage` state/handler `handleCheck`, khoá `selectAnswer` | `ExamIntro.tsx`, `ExamPage.tsx` |
| 8 | `ExamSession` nút Check, feedback panel (component con `AnswerFeedbackPanel.tsx`), navigator, bộ đếm | `ExamSession.tsx`, `components/exam/AnswerFeedbackPanel.tsx` |
| 9 | `ExamShare` toggle; `ExamResult` badge | `ExamShare.tsx`, `ExamResult.tsx` |
| 10 | Tài liệu: `docs/exam-engine.md` (mục Feedback Modes), `docs/03-api_design.md`, `docs/02-data_model.md`, `CHANGELOG.md` | docs |
| 11 | Chạy toàn bộ test + checklist hồi quy §9 + code review | — |

---

## 8. Kế hoạch kiểm thử

### 8.1. Backend unit (Jest — `backend/src/attempts/attempts.service.spec.ts`)

- `start`: mặc định `END_OF_EXAM`; lưu `INTERACTIVE`; `TIME_PRESSURE + INTERACTIVE` ⇒ `BadRequestException`; response không chứa `isCorrect`/`explanation` (test hiện có về relabel vẫn xanh).
- `checkAnswer`: happy path đúng / sai; MULTIPLE thiếu, thừa, đủ; C1–C7 mỗi điều kiện một case; race — `updateMany` count 0 ⇒ `ConflictException`; `explanation = null` ⇒ trả `null`; `questionOrder` gán đúng cho answer mới.
- `submit`: câu đã khoá dùng đáp án đã lưu khi payload khác; câu chưa khoá chấm từ payload; attempt `END_OF_EXAM` cho kết quả **y hệt** trước (các test `evaluateAnswers` hiện có giữ nguyên, không sửa kỳ vọng).
- `saveAnswer`: câu đã khoá ⇒ `409`; các test `questionOrder` hiện có vẫn xanh.
- `isAnswerCorrect`: bảng test (rỗng, đủ, thiếu, thừa, trùng id).

### 8.2. Backend E2E (`backend/test/exam-interactive.e2e-spec.ts`, `npm run test:e2e`)

- Luồng đầy đủ: start INTERACTIVE → check 2 câu (1 đúng, 1 sai) → submit với payload giả mạo cho câu đã check → điểm đúng theo đáp án đã check.
- `check` trên attempt END_OF_EXAM ⇒ 403; attempt của user khác ⇒ 403; câu ngoài exam ⇒ 400; check lần 2 ⇒ 409; sau submit ⇒ 400.
- Start không body ⇒ END_OF_EXAM (tương thích ngược). `exam-catalog.e2e-spec.ts` hiện có vẫn xanh.

### 8.3. Frontend (Vitest + Testing Library)

- `src/components/exam/__tests__/ExamSession.test.tsx`:
  - Exam Mode: không có nút Check, không panel (snapshot hành vi cũ).
  - Interactive: nút Check disable khi chưa chọn; sau khi có `feedback` ⇒ panel Correct/Incorrect, explanation render, fallback khi không có explanation, choice bị disable, navigator hiển thị trạng thái Correct/Incorrect, `aria-live` có nội dung.
- `src/components/exam/__tests__/ExamIntro.test.tsx`: chọn Interactive gọi callback; TIME_PRESSURE disable Interactive và reset về Exam.
- `src/pages/__tests__/ExamPage.interactive.test.tsx` (mock `services/attempts`): `startAttempt` được gọi với `{ feedbackMode: 'INTERACTIVE' }`; `handleCheck` gọi `checkAnswer` đúng payload; `selectAnswer` bị chặn sau check; lỗi mạng ⇒ toast + cho thử lại; submit payload vẫn gửi đủ câu.
- `src/pages/__tests__/ExamShare.test.tsx`: start với mode đã chọn; exam TIME_PRESSURE luôn là Exam Mode.

### 8.4. Playwright (`e2e/exam-interactive.spec.ts`)

Mock toàn bộ API bằng `page.route` và seed auth store trong `localStorage`, nên chạy được không cần backend/credential và đã được thêm vào `npm run test:e2e` (job `e2e-smoke` trên CI): chọn Interactive → trả lời → Check → thấy "Correct!"/"Incorrect" + giải thích → Next question → Finish exam → trang kết quả có badge; và một case Exam Mode không có nút Check.

### 8.5. Lệnh bắt buộc chạy trước khi coi là xong

```bash
# backend
cd backend && npm install && npm run build && npm run test && npm run test:e2e
# frontend (root)
npm run lint && npm run test && npm run build
```

---

## 9. Checklist hồi quy — các tính năng cũ không được break

| # | Tính năng liên quan | Cách xác nhận |
|---|---|---|
| R1 | Exam Mode mặc định (ExamIntro → Start → Submit → Result) | Test FE Exam Mode + test `evaluateAnswers` cũ không sửa kỳ vọng |
| R2 | Start từ **ExamLibrary** / **ExamShare** (`location.state.attemptData`, bỏ qua intro) | E2E start không body; test ExamPage với `passedAttempt` không có `feedbackMode` |
| R3 | Org catalog exam (`/exam/org-catalog`) | `exam-catalog.e2e-spec.ts` xanh; `check` trả 403 |
| R4 | Training: PracticeSession / WeaknessMode (`/answer`, `/finish`) | Test `saveAnswer` cũ xanh; `finish` không đổi |
| R5 | 4 timer mode + auto-submit khi hết giờ | Test timer/`e2e/time-pressure.spec.ts`; AC-9 |
| R6 | Mark-for-review (flag) và màu navigator | Test ExamSession: Flagged vẫn ưu tiên hơn Checked |
| R7 | Thứ tự câu hỏi trong review kết quả (`questionOrder`, fix #2d81311) | Test "orders answerRecords by submitted order" xanh |
| R8 | Relabel choice a–d (fix #e28fcec) | Test relabel trong `start` xanh; panel dùng label đang hiển thị |
| R9 | Chống double-count `questionId` trùng trong payload | Test hiện có xanh |
| R10 | Word capture (`WordCaptureTooltip`) trong phiên thi | Không đổi `useTextSelection(phase === "exam")`; kiểm tra thủ công |
| R11 | Gamification, `attemptCount`, `avgScore`, lịch sử `/attempts/me` | Unit test submit gọi `awardPoints`/`updateAvgScore` như cũ |
| R12 | Scenario question (`isScenario` hiển thị context) | `ScenarioExam.spec.tsx` xanh |
| R13 | Xoá exam có attempt (soft-delete, #136) | Không đụng; e2e hiện có xanh |
| R14 | A11y & visual regression | `e2e/a11y.spec.ts`, `e2e/visual-regression.spec.ts` — Exam Mode không đổi snapshot |

---

## 10. Quyết định

### 10.1. Đã chốt (2026-09-25)

| # | Câu hỏi | Quyết định |
|---|---|---|
| D1 | Mode lưu ở mức attempt hay exam? | **Attempt** (`ExamAttempt.feedbackMode`): người thi chọn mỗi lần, không cần tạo exam mới |
| D2 | Sau khi xem đáp án có được sửa lại không? | **Không**: câu bị khoá (`checkedAt`) ở cả UI lẫn server |
| D3 | Interactive có dùng được với TIME_PRESSURE? | **Không**. Được với RELAXED / STRICT / ACCELERATED; timer vẫn chạy khi đọc giải thích |
| D4 | Điểm vào nào được chọn Interactive? | `ExamIntro` + `ExamShare`. `ExamLibrary` giữ Exam Mode; org catalog / assessment luôn Exam Mode |
| D5 | Attempt Interactive có tính vào `avgScore`, điểm thưởng, readiness? | **Tính như bình thường**; lưu `feedbackMode` để tách riêng về sau |
| D6 | Tương tác nút Check | Phải bấm **Check answer** mới chấm (kể cả câu SINGLE). Sau khi check, hiện đúng/sai + giải thích ngay, và nút đổi thành **Next question** để sang câu tiếp (câu cuối: **Finish exam**) |

---

## 11. Definition of Done

- [x] D1–D6 được chốt và ghi lại trong §10.
- [ ] Toàn bộ FR-1 → FR-8 được triển khai; AC-1 → AC-15 được test (tự động, hoặc thủ công với ghi chú trong PR khi Playwright bị skip do thiếu credential).
- [ ] Lệnh ở §8.5 chạy xanh; không test cũ nào bị sửa kỳ vọng để "cho qua".
- [ ] Checklist hồi quy §9 được tick trong mô tả PR.
- [ ] Code review (`/code-review`) không còn finding mức blocking; không có breaking change với API/UI cũ.
- [ ] Docs cập nhật (`exam-engine.md`, `03-api_design.md`, `02-data_model.md`, `CHANGELOG.md`).

---

## 12. Liên kết

- `src/pages/ExamPage.tsx`, `src/components/exam/ExamSession.tsx`, `ExamIntro.tsx`, `ExamResult.tsx`
- `src/pages/ExamLibrary.tsx`, `src/pages/ExamShare.tsx`, `src/pages/org/OrgExamCatalog.tsx`
- `src/components/training/PracticeSession.tsx` — mẫu UI reveal + explanation đã có
- `backend/src/attempts/attempts.service.ts`, `attempts.controller.ts`, `dto/*`
- `backend/src/exam-catalog/exam-catalog.service.ts#startCatalogExam`
- `backend/prisma/schema.prisma` — `ExamAttempt`, `Answer`, `Question.explanation`
- `docs/exam-engine.md` — tài liệu engine hiện tại
