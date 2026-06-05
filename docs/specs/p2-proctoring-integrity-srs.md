# SRS — P2: Proctoring & Integrity

| | |
|---|---|
| **Tài liệu** | Software Requirements Specification (SRS) |
| **Tính năng** | P2 — Proctoring & Integrity |
| **Phiên bản** | 1.0 (Implemented) |
| **Ngày** | 2026-06-05 |
| **Trạng thái** | Đã triển khai — tài liệu hóa sau implement |
| **Phụ thuộc** | P1 (ATS-lite) — để recruiter xem Integrity Score trong pipeline |
| **Module liên quan** | `assessments` (backend) · `CandidateExam.tsx`, `CandidateRanking.tsx` (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Tài liệu này đặc tả yêu cầu cho **P2 — Proctoring & Integrity**, nâng cao độ tin cậy của bài thi ứng viên thông qua ba cơ chế: xác thực danh tính bằng OTP trước khi làm bài, ép buộc fullscreen để hạn chế gian lận, và ghi nhận sự kiện hành vi để tính toán điểm liêm chính (Integrity Score). Recruiter xem kết quả kèm timeline sự kiện để đưa ra quyết định tuyển dụng sáng suốt hơn.

### 1.2. Phạm vi

**Trong phạm vi:**
- Cấu hình per-assessment: `requireFullscreen`, `requireOtp`, `maxAttempts`.
- Luồng OTP: request → email → verify → bắt đầu làm bài (nếu `requireOtp = true`).
- Fullscreen enforcement: yêu cầu, phát hiện thoát, cảnh báo, ghi event.
- `CandidateEvent` model: lưu mọi sự kiện hành vi trong quá trình làm bài.
- `reportEvent` endpoint: nhận event từ frontend.
- Tính `integrityScore` tại thời điểm submit (0–100).
- Chặn làm lại: một token chỉ làm được một lần (`maxAttempts = 1` là default).
- Frontend: màn OTP, cảnh báo fullscreen, hiển thị Integrity Score + event timeline.

**Ngoài phạm vi:**
- Webcam proctoring / AI face detection.
- Screen recording.
- Browser lockdown (chặn cài extension, mở DevTools).
- OTP qua SMS.
- OTP lưu Redis (hiện tại in-memory — TODO khi deploy multi-pod).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| **requireFullscreen** | Assessment flag: bắt ứng viên vào fullscreen khi bắt đầu; phát hiện thoát |
| **requireOtp** | Assessment flag: ứng viên phải nhập mã OTP gửi qua email trước khi xem đề |
| **maxAttempts** | Số lần tối đa được làm bài (default 1 — enterprise use case) |
| **CandidateEvent** | Bản ghi một sự kiện hành vi: loại, thời điểm client, payload JSON |
| **Integrity Score** | Điểm 0–100 tính từ số vi phạm: tab switch, fullscreen exit, copy/paste |
| **Phase** | Trạng thái UI của CandidateExam: `loading → intro → otp → exam → submitting` |

### 1.4. Hiện trạng trước P2

- `detectTabSwitch` và `blockCopyPaste` đã có nhưng chỉ ghi `tabSwitchCount` — không có event table.
- Không có OTP.
- Không có fullscreen enforcement.
- Không có `integrityScore`.
- Token đã submit có thể bị load lại (lỗ hổng).

---

## 2. Mô tả tổng quan

### 2.1. Bối cảnh sản phẩm

Bài thi tuyển dụng thật cần mức độ tin cậy cao hơn flashcard hay exam thực hành. P2 thêm 3 lớp bảo vệ độc lập:

1. **OTP** — xác thực email ứng viên trước khi xem đề (chặn người khác dùng thay).
2. **Fullscreen** — giảm cơ hội tra cứu công khai trong khi làm bài.
3. **Event logging + Integrity Score** — không chặn hoàn toàn gian lận nhưng tạo bằng chứng cho recruiter.

### 2.2. Thiết kế nguyên tắc

- Proctoring chỉ **ghi nhận và tính điểm**, không tự động disqualify ứng viên.
- Recruiter là người đưa ra quyết định cuối dựa trên Integrity Score + timeline.
- Mọi mechanism là **per-assessment opt-in** (default: tắt) — không ảnh hưởng assessment cũ.

---

## 3. Yêu cầu chức năng

### FR-1 — Cấu hình proctoring per-assessment

**FR-1.1**: Thêm fields vào `Assessment`:

```prisma
requireFullscreen Boolean @default(false) @map("require_fullscreen")
requireOtp        Boolean @default(false) @map("require_otp")
maxAttempts       Int     @default(1)     @map("max_attempts")
```

**FR-1.2**: `CreateAssessmentDto` và `UpdateAssessmentDto` expose các fields này.

**FR-1.3**: `GET /take/:token` (public) trả `requireFullscreen`, `requireOtp`, `otpVerifiedAt` (của invite) để frontend quyết định luồng.

---

### FR-2 — Chặn làm lại (maxAttempts)

**FR-2.1**: `POST /take/:token/start`: nếu `invite.status === 'SUBMITTED'` → `403 Forbidden: "This assessment has already been submitted"`.

**FR-2.2**: `maxAttempts` hiện tại enforce ở mức: 1 lần submit = hết. Mở rộng trong tương lai nếu `maxAttempts > 1`.

**FR-2.3**: Invite có `status = 'EXPIRED'` → `403 Forbidden: "This assessment link has expired"`.

---

### FR-3 — OTP verification

**FR-3.1**: Luồng OTP (chỉ áp dụng nếu `requireOtp = true`):

```
Ứng viên mở link → GET /take/:token (check requireOtp)
                 → POST /take/:token/otp/request  (gửi mã qua email)
                 → Nhập mã → POST /take/:token/otp/verify
                 → Nếu đúng → cho phép POST /take/:token/start
```

**FR-3.2**: `POST /take/:token/otp/request`:
- Sinh mã 6 chữ số ngẫu nhiên.
- Hash bằng `crypto.scryptSync` (salt cố định per-request).
- Lưu vào in-memory store: `Map<inviteId, { hash, expiresAt }>` với TTL = 10 phút.
- Gửi email qua `MailService` đến `invite.candidateEmail`.
- Log email ẩn danh (ví dụ: `t***@example.com`) để trace, không log mã OTP.
- Trả: `{ message: "OTP sent to t***@example.com" }`.

**FR-3.3**: `POST /take/:token/otp/verify`:
- Body: `{ code: string }`.
- Lấy entry từ store; nếu không có → `400: "No OTP requested"`.
- Nếu `expiresAt < now()` → xóa khỏi store, `400: "OTP has expired"`.
- Nếu hash không khớp → `400: "Invalid OTP"`.
- Nếu đúng → xóa khỏi store, set `invite.otpVerifiedAt = now()`.

**FR-3.4**: `POST /take/:token/start`:
- Nếu `assessment.requireOtp && !invite.otpVerifiedAt` → `403: "OTP verification required before starting"`.

**FR-3.5**: ⚠️ **Known limitation**: OTP store in-memory — không hoạt động với multiple server instances. Cần migrate sang Redis SETEX/GET/DEL khi deploy multi-pod. Đây là intentional shortcut cho single-pod MVP.

---

### FR-4 — Fullscreen enforcement

**FR-4.1**: `GET /take/:token` trả `requireFullscreen`. Frontend xử lý:

- Khi phase chuyển sang `exam` và `requireFullscreen = true`:
  ```js
  document.documentElement.requestFullscreen().catch(() => {});
  ```
- Lắng nghe `fullscreenchange` event: nếu `!document.fullscreenElement` trong phase `exam` → hiển thị cảnh báo overlay + gọi `reportEvent(token, 'FULLSCREEN_EXIT')`.
- Khi submit → thoát fullscreen: `document.exitFullscreen().catch(() => {})`.

**FR-4.2**: Cảnh báo overlay hiển thị: "Bạn đã thoát fullscreen. Vui lòng quay lại fullscreen để tiếp tục làm bài." + nút "Quay lại fullscreen".

**FR-4.3**: Thoát fullscreen **không dừng exam** — ứng viên vẫn có thể tiếp tục; event được ghi để recruiter biết.

---

### FR-5 — CandidateEvent: ghi nhận sự kiện

**FR-5.1**: Model:

```prisma
model CandidateEvent {
  id        String   @id @default(uuid())
  inviteId  String   @map("invite_id")
  eventType String   @map("event_type")
  payload   Json     @default("{}")
  clientTs  DateTime @map("client_ts")
  createdAt DateTime @default(now()) @map("created_at")

  invite CandidateInvite @relation(...)
  @@index([inviteId, clientTs])
  @@map("candidate_events")
}
```

**FR-5.2**: Endpoint ghi event (public, token-based):

```
POST /assessments/take/:token/event
Body: { eventType: string, clientTs?: string, payload?: object }
```

Các `eventType` hợp lệ:

| eventType | Trigger | Payload |
|---|---|---|
| `FULLSCREEN_EXIT` | Thoát fullscreen | `{}` |
| `TAB_SWITCH` | `visibilitychange` hidden | `{}` |
| `COPY` | `copy` event trên document | `{}` |
| `PASTE` | `paste` event trên document | `{}` |
| `BLUR` | `window.blur` | `{}` |

**FR-5.3**: `tabSwitchCount` trên `CandidateInvite` vẫn được increment khi nhận `TAB_SWITCH` event (backward compat với logic cũ).

**FR-5.4**: Endpoint không validate `clientTs` nghiêm ngặt — accept ISO string hoặc null, fallback về `now()`.

---

### FR-6 — Tính Integrity Score

**FR-6.1**: Tính tại thời điểm `POST /take/:token/submit` (trong `$transaction`):

```
score = 100
score -= min(tabSwitchCount × 5, 40)    // mỗi tab switch -5, tối đa -40
score -= min(fullscreenExits × 3, 30)   // mỗi fullscreen exit -3, tối đa -30
if (hasCopyOrPaste) score -= 15          // -15 nếu có bất kỳ copy/paste nào
score = max(0, min(100, round(score)))
```

**FR-6.2**: Lưu vào `CandidateInvite.integrityScore` (0–100).

**FR-6.3**: Score chỉ tính **một lần** tại submit; không recalculate sau đó (bất biến).

**FR-6.4**: `getResults` endpoint trả `integrityScore` cho mỗi invite.

---

### FR-7 — Xem event timeline (recruiter)

**FR-7.1**: Endpoint:

```
GET /organizations/:orgId/assessments/:aid/candidates/:inviteId/events
Guard: OrgRole(OWNER, ADMIN, MANAGER, RECRUITER)
Response: CandidateEvent[]  (sắp xếp theo clientTs ASC)
```

**FR-7.2**: Frontend `CandidateDetailDrawer` fetch events khi mở drawer (lazy load).

**FR-7.3**: Hiển thị timeline theo thứ tự thời gian: icon + label theo eventType + timestamp.

---

### FR-8 — Frontend: luồng 4 phase

**FR-8.1**: `CandidateExam.tsx` có state `phase: 'loading' | 'intro' | 'otp' | 'exam' | 'submitting'`.

**FR-8.2**: Transition:

```
loading → (check requireOtp + otpVerifiedAt)
        → nếu requireOtp && !otpVerifiedAt → otp (gọi requestOtp auto)
        → else → intro
otp → (verify thành công) → intro
intro → (click Start) → exam (request fullscreen nếu cần) → submitting → /result
```

**FR-8.3**: Màn `otp`:
- Input 6 chữ số.
- Nút "Gửi lại mã" (cooldown 60s sau khi gửi).
- Hiển thị lỗi từ verify response.

**FR-8.4**: `IntegrityBadge` trong `CandidateRanking`:
- Score 80–100: badge xanh "High".
- Score 50–79: badge vàng "Medium".
- Score 0–49: badge đỏ "Low".
- `null` (chưa submit): không hiển thị badge.

---

## 4. Yêu cầu phi chức năng

| ID | Yêu cầu |
|---|---|
| NFR-1 (OTP security) | Mã OTP không bao giờ được log dạng plaintext. Hash trước khi lưu store. |
| NFR-2 (Event throughput) | `reportEvent` phải response < 100ms — insert đơn giản, không cần validation nặng. |
| NFR-3 (Score immutability) | `integrityScore` không được update sau khi submit. Nếu cần recalculate → cần endpoint admin riêng (không trong P2). |
| NFR-4 (Fullscreen UX) | Cảnh báo fullscreen không block keyboard/mouse — ứng viên vẫn có thể trả lời câu hỏi mà không cần quay lại fullscreen. |
| NFR-5 (Multi-pod OTP) | TODO: migrate OTP store từ in-memory sang Redis `SETEX` key = `otp:{inviteId}`, TTL = 600s khi horizontal scale. |
| NFR-6 (A11y) | Màn OTP, cảnh báo fullscreen phải accessible bằng keyboard; `aria-live` cho thông báo lỗi OTP. |

---

## 5. Acceptance Criteria

### AC-1 — Chặn làm lại
- [ ] Token đã SUBMITTED → `POST /take/:token/start` trả `403` với message rõ ràng.
- [ ] Token hết hạn (`expiresAt` quá khứ) → `403`.

### AC-2 — OTP
- [ ] `requireOtp = true`: mở link → tự động request OTP → nhận email (Mailtrap) → nhập đúng → vào intro.
- [ ] Nhập sai → thông báo lỗi, không vào exam.
- [ ] OTP hết hạn (10 phút) → `400: "OTP has expired"`.
- [ ] `requireOtp = false`: mở link → thẳng vào intro, không có màn OTP.

### AC-3 — Fullscreen
- [ ] `requireFullscreen = true`: click Start → browser request fullscreen.
- [ ] Thoát fullscreen → overlay cảnh báo hiển thị + event `FULLSCREEN_EXIT` được ghi vào `CandidateEvent`.
- [ ] Submit → thoát fullscreen tự động.

### AC-4 — Integrity Score
- [ ] Ứng viên tab-switch 3 lần + 1 fullscreen exit + copy 1 lần → `integrityScore = 100 - 15 - 3 - 15 = 67`.
- [ ] Ứng viên không vi phạm gì → `integrityScore = 100`.
- [ ] 8 tab-switch + 10 fullscreen exit + copy → `integrityScore = max(0, 100 - 40 - 30 - 15) = 15`.
- [ ] Score bất biến sau submit (gọi lại `getResults` → cùng score).

### AC-5 — Event timeline
- [ ] `GET .../candidates/:inviteId/events` trả list sự kiện theo `clientTs ASC`.
- [ ] `CandidateDetailDrawer` hiển thị timeline khi mở.
- [ ] RECRUITER gọi endpoint → `200` (không bị chặn).

---

## 6. Vấn đề mở & Known Issues

| # | Vấn đề | Trạng thái |
|---|---|---|
| KI-1 | OTP in-memory không scale multi-pod | Documented TODO; cần Redis migration trước horizontal scale |
| KI-2 | Fullscreen không thể enforce trên iOS Safari (API không hỗ trợ) | Accept limitation; warn user nếu mobile |
| KI-3 | Copy-paste detection không bắt được nếu ứng viên dùng right-click menu của hệ điều hành | Known gap; `blockCopyPaste` chặn keyboard shortcut nhưng không chặn context menu |
| KI-4 | `FAST_ANSWER` event (câu trả lời bất thường nhanh) đề xuất trong plan nhưng chưa implement | Backlog — cần thêm `timeSpent` per question analysis |

---

## 7. Liên kết

- **Kế hoạch tổng**: [enterprise-entrance-exam-plan.md](../enterprise-entrance-exam-plan.md)
- **Schema**: [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma)
- **Candidate service**: [backend/src/assessments/candidate.service.ts](../../backend/src/assessments/candidate.service.ts)
- **Frontend exam**: [src/pages/CandidateExam.tsx](../../src/pages/CandidateExam.tsx)
- **Frontend ranking + drawer**: [src/components/org/CandidateRanking.tsx](../../src/components/org/CandidateRanking.tsx)
- **P3 SRS** (tiếp theo): [docs/specs/p3-branding-email-compliance-srs.md](./p3-branding-email-compliance-srs.md)
