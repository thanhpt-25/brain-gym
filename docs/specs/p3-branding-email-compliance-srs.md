# SRS — P3: Branding, Email & Compliance

| | |
|---|---|
| **Tài liệu** | Software Requirements Specification (SRS) |
| **Tính năng** | P3 — Branding, Email & Compliance (Enterprise Entrance Exam) |
| **Phiên bản** | 0.1 (Draft — để review) |
| **Ngày** | 2026-06-05 |
| **Trạng thái** | Draft, chưa triển khai code |
| **Phụ thuộc** | P0 (Smart Builder) · P1 (ATS-lite) · P2 (Proctoring & Integrity) |
| **Module liên quan** | `assessments`, `mail`, `organizations` (backend) · `CandidateExam`, `AssessmentResults`, `OrgSettings` (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Tài liệu này đặc tả yêu cầu cho **P3 — Branding, Email & Compliance**, giai đoạn cuối trong lộ trình Enterprise Entrance Exam. P3 biến quy trình đánh giá ứng viên thành một trải nghiệm chuyên nghiệp, đầy đủ thương hiệu doanh nghiệp, đồng thời đáp ứng các yêu cầu pháp lý về bảo vệ dữ liệu cá nhân (GDPR/PDPA).

### 1.2. Phạm vi

**Trong phạm vi:**
- Email mời/nhắc/kết quả có thương hiệu org (logo, màu, tên).
- Trang làm bài của ứng viên hiển thị branding của org.
- Xuất báo cáo PDF kết quả per-candidate.
- Retention policy và ẩn danh hóa dữ liệu PII của ứng viên (GDPR).
- Audit log cho mọi thao tác liên quan đến assessment.

**Ngoài phạm vi:**
- Custom domain (white-label subdomain) cho org — để dành roadmap sau.
- Email marketing / drip campaign.
- Chữ ký điện tử lên PDF.
- Tích hợp GDPR subject-access-request portal đầy đủ (SAR).
- Xử lý thanh toán / billing.

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| **PII** | Personally Identifiable Information — thông tin có thể nhận diện cá nhân (email, tên, IP) |
| **Anonymization** | Ẩn danh hóa không thể đảo ngược (khác với pseudonymization) |
| **Retention policy** | Chính sách lưu giữ dữ liệu: sau N ngày kể từ ngày submit, PII bị ẩn danh tự động |
| **Branded email** | Email gửi bằng SMTP thật, nội dung dùng logo/màu/tên của org |
| **Audit log** | Bản ghi bất biến mọi thao tác quản trị trên assessment |
| **Integrity Score** | Điểm liêm chính tính từ P2 (0–100), được in vào PDF |

### 1.4. Hiện trạng (baseline)

| Thành phần | Trạng thái |
|---|---|
| `Organization.logoUrl` / `accentColor` | ✅ Có trong schema ([schema.prisma:807–810](../../backend/prisma/schema.prisma)) |
| `MailService` (nodemailer + Mailtrap) | ✅ Có, nhưng email dùng HTML tĩnh không có branding ([mail.service.ts](../../backend/src/mail/mail.service.ts)) |
| `AuditLog` (platform-level) | ✅ Có ([schema.prisma:781](../../backend/prisma/schema.prisma)), nhưng chưa ghi thao tác assessment |
| `CandidateInvite.candidateEmail/Name/ipAddress` | ✅ Có — cần anonymize theo retention |
| `CandidateInvite.integrityScore` | ✅ Có (P2) — cần đưa vào PDF |
| PDF export | ❌ Chưa có |
| Branded email templates | ❌ Chưa có |
| Retention/anonymization cron | ❌ Chưa có |
| Assessment audit log | ❌ Chưa có |
| Reminder cron (nhắc hạn invite) | ❌ Chưa có |

---

## 2. Mô tả tổng quan

### 2.1. Bối cảnh sản phẩm

P3 là "polish layer" bắt buộc trước khi một doanh nghiệp thật có thể dùng Assessment cho tuyển dụng chính thức:

- Ứng viên hiện nhận email plain-HTML từ `Brain Gym <noreply@braingym.app>` — không phản ánh thương hiệu công ty đang tuyển.
- Trang làm bài `/assess/:token` hiện dùng giao diện generic của Brain Gym — không có nhận diện thương hiệu.
- Khi có sự cố tranh chấp, không có audit trail đủ để tra cứu ai đã làm gì.
- Nếu có ứng viên EU, việc không có retention policy tạo rủi ro pháp lý ngay khi go-live.

### 2.2. Nhóm người dùng

| Vai trò | Nhu cầu P3 |
|---|---|
| **Ứng viên** | Nhận email từ brand công ty, làm bài trong giao diện có thương hiệu |
| **Recruiter** | Xuất PDF trình CHro/hiring manager, xem thao tác lịch sử |
| **Admin org (Owner/Admin)** | Cấu hình retention, xem audit log, đảm bảo tuân thủ nội bộ |
| **DPO / Legal** | Xác nhận PII được ẩn danh đúng hạn, có endpoint xóa theo yêu cầu ứng viên |

### 2.3. Giả định & ràng buộc

- `Organization.logoUrl` là URL công khai (CDN/S3) — không upload trong P3; org đã cấu hình qua OrgSettings hiện có.
- `Organization.accentColor` là hex string, ví dụ `#1a56db`.
- Mailtrap dùng cho dev; prod dùng SMTP thật (Gmail/SES) cấu hình qua env vars — **không thay đổi transport layer trong P3**.
- PDF render phía server bằng thư viện `@playwright/browser` hoặc `puppeteer` (headless) nếu đã available trong Docker image; nếu không có sẵn, fallback về `pdfkit` (pure Node.js).
- Retention anonymization **không xóa** bản ghi — chỉ nullify/mask PII để aggregate statistics còn intact.
- TypeScript loose (`strictNullChecks: false`) — tuân theo style sẵn có.

### 2.4. Quyết định cần chốt (mở)

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| D1 | PDF render: server-side (puppeteer/Playwright) hay client-side (browser `window.print`)? | **Server-side** (puppeteer/pdfkit) — nhất quán, không phụ thuộc browser của recruiter |
| D2 | Thư viện PDF: `puppeteer` (HTML→PDF, đẹp hơn) hay `pdfkit` (pure Node, nhẹ hơn)? | `pdfkit` nếu Docker image không có Chromium; `puppeteer` nếu có — cần xác nhận môi trường |
| D3 | Reminder email: gửi trước bao nhiêu giờ? | 24h trước `expiresAt`, gửi 1 lần, không lặp |
| D4 | Retention default: bao nhiêu ngày? | **365 ngày** mặc định; org có thể tự hạ xuống tối thiểu 30 ngày |
| D5 | Endpoint xóa PII: ai gọi? | Recruiter/Admin gọi thay ứng viên (vì ứng viên không có tài khoản); hoặc ứng viên gửi email support → admin trigger |

---

## 3. Yêu cầu chức năng

> Quy ước độ ưu tiên: **P1** = MVP (phải có) · **P2** = nên có · **P3** = nâng cao.

---

### FR-1 — Branded email templates `[P1]` ← US-P3-1

#### FR-1.1 Template layout

Tất cả email gửi cho ứng viên (invite, reminder, result) phải dùng **HTML template có branding** bao gồm:
- Header: `logoUrl` của org (img tag, max-height 48px, fallback text = org name nếu null).
- Accent color: nút CTA, đường kẻ header dùng `accentColor` (fallback `#6366f1` nếu null).
- Footer: tên org, không có branding "Brain Gym" nếu org đã cấu hình logo.

#### FR-1.2 Loại email bắt buộc có branding

| Event | Template | Trigger |
|---|---|---|
| **Invite** | `assessment-invite.html` | Khi tạo `CandidateInvite` (đã có, cần rebrand) |
| **Reminder** | `assessment-reminder.html` | Cron 24h trước `expiresAt`, chỉ gửi nếu `status = INVITED` |
| **Result (pass/fail)** | `assessment-result.html` | Sau khi ứng viên submit, nếu org bật `sendResultEmail` |

#### FR-1.3 Cấu hình gửi email kết quả

- Thêm field `sendResultEmail Boolean @default(false)` vào `Assessment`.
- Nếu bật: sau submit, gửi email tóm tắt điểm + pass/fail (không tiết lộ câu đúng/sai).

#### FR-1.4 Nội dung template

Email invite phải chứa: tên org, tên assessment, link (token), hạn (expiresAt format ngày/giờ timezone UTC). Email reminder: tương tự + thông điệp "hạn còn X giờ". Email result: điểm, pass/fail, (tùy chọn) domain breakdown.

---

### FR-2 — Branded candidate exam page `[P1]` ← US-P3-2

#### FR-2.1 Load branding khi mở `/assess/:token`

- `GET /assessments/take/:token` (public) mở rộng response trả thêm `branding: { orgName, logoUrl, accentColor }`.
- Backend query `assessment → organization` để lấy branding fields.

#### FR-2.2 Áp dụng branding trong CandidateExam

- Header trang: logo org (nếu có) thay thế logo Brain Gym; tên org hiển thị làm subtitle.
- Accent color áp dụng cho: nút "Bắt đầu", nút "Nộp bài", thanh tiến trình (progress bar), badge domain.
- Nếu `logoUrl` null và `accentColor` null → giữ nguyên giao diện mặc định Brain Gym.

#### FR-2.3 CandidateResult cũng có branding

- Trang `/assess/:token/result` dùng cùng branding context.

---

### FR-3 — Export PDF per-candidate `[P1]` ← US-P3-3

#### FR-3.1 Endpoint

```
GET /organizations/:orgId/assessments/:aid/candidates/:inviteId/pdf
Authorization: JWT + OrgRole(OWNER, ADMIN, MANAGER, RECRUITER)
Response: application/pdf; filename="candidate-{inviteId}.pdf"
```

#### FR-3.2 Nội dung PDF

| Section | Nội dung |
|---|---|
| **Header** | Logo org + tên org; tên assessment; ngày xuất |
| **Ứng viên** | Tên (hoặc "—" nếu đã anonymized), email (hoặc "***@***.***"), ngày submit |
| **Kết quả** | Điểm tổng (%), Pass/Fail badge, thời gian làm bài |
| **Domain breakdown** | Bảng điểm theo domain (từ `domainScores` JSON) |
| **Integrity** | Integrity Score (từ P2), số tab-switch, có vi phạm fullscreen không |
| **Footer** | "Tài liệu bảo mật — chỉ dành cho mục đích nội bộ" + timestamp |

#### FR-3.3 Nút export trong UI

- [AssessmentResults.tsx](../../src/pages/org/AssessmentResults.tsx): thêm nút "Export PDF" trong drawer chi tiết của từng ứng viên.
- Click → gọi endpoint, browser download file.

#### FR-3.4 Trạng thái chưa submit

- Nếu `status != SUBMITTED` → trả `400 Bad Request`: "Ứng viên chưa hoàn thành bài thi".

---

### FR-4 — Reminder email cron `[P2]`

#### FR-4.1 Cron job

- Chạy mỗi giờ (cron expression: `0 * * * *`).
- Query `CandidateInvite` có `status = INVITED` và `expiresAt` trong khoảng (now + 23h, now + 25h).
- Gửi 1 email reminder / invite, **không gửi lại** (thêm field `reminderSentAt DateTime?` để idempotent).

#### FR-4.2 Cấu hình per-assessment

- Thêm field `sendReminderEmail Boolean @default(true)` vào `Assessment`.
- Nếu false → cron bỏ qua invite thuộc assessment này.

---

### FR-5 — Retention policy & anonymization `[P1]` ← US-P3-4

#### FR-5.1 Cấu hình retention per-org

Thêm field vào `Organization`:
```prisma
retentionDays Int @default(365) @map("retention_days")
```
- Min 30, max 3650 (10 năm). Validate trong DTO.
- UI cấu hình: OrgSettings → tab "Tuân thủ" → input "Lưu trữ dữ liệu ứng viên (ngày)".

#### FR-5.2 Anonymization cron

- Chạy mỗi ngày lúc 02:00 UTC (cron: `0 2 * * *`).
- Query `CandidateInvite` có `submittedAt < now() - retentionDays days` và `anonymizedAt IS NULL`.
- Anonymize: `candidateEmail = 'anonymized@example.com'`, `candidateName = null`, `ipAddress = null`.
- Set `anonymizedAt = now()`.
- **Giữ lại**: score, domainScores, integrityScore, stage, rating, timestamps — để analytics aggregate còn dùng được.
- Nếu `status = INVITED` (chưa làm): không anonymize (không có `submittedAt`); bản ghi expire tự nhiên.

Thêm field vào `CandidateInvite`:
```prisma
anonymizedAt DateTime? @map("anonymized_at")
```

#### FR-5.3 Endpoint xóa theo yêu cầu ứng viên

```
DELETE /organizations/:orgId/assessments/:aid/candidates/:inviteId/pii
Authorization: JWT + OrgRole(OWNER, ADMIN)
```
- Thực hiện anonymization ngay lập tức (không chờ cron).
- Trả `200 { anonymizedAt }`.
- Ghi audit log action `CANDIDATE_PII_DELETED`.

#### FR-5.4 Hiển thị trạng thái anonymized trong UI

- [AssessmentResults.tsx](../../src/pages/org/AssessmentResults.tsx): nếu `anonymizedAt` có giá trị → hiển thị badge "Đã ẩn danh", email hiển thị `***@***.***`.
- Nút "Export PDF" vẫn có thể nhấn; PDF sẽ in email/tên dưới dạng đã ẩn danh.

---

### FR-6 — Audit log cho assessment `[P1]` ← US-P3-5

#### FR-6.1 Các thao tác cần ghi audit

Tái dùng model `AuditLog` hiện có ([schema.prisma:781](../../backend/prisma/schema.prisma)). Ghi audit với `targetType = 'Assessment'` hoặc `'CandidateInvite'`:

| Action | Trigger |
|---|---|
| `ASSESSMENT_CREATED` | Tạo assessment |
| `ASSESSMENT_UPDATED` | Sửa cấu hình assessment |
| `ASSESSMENT_STATUS_CHANGED` | Activate / Close / Archive |
| `CANDIDATE_INVITED` | Tạo CandidateInvite (ghi email vào metadata) |
| `CANDIDATE_STAGE_UPDATED` | Đổi stage (APPLIED → SHORTLISTED, REJECTED, HIRED) |
| `CANDIDATE_DECISION_SET` | Recruiter ghi rating/note |
| `CANDIDATE_PII_DELETED` | Anonymize PII theo yêu cầu (FR-5.3) |
| `PDF_EXPORTED` | Recruiter export PDF (ghi inviteId) |

#### FR-6.2 Hiển thị audit log

- [OrgSettings.tsx](../../src/pages/org/OrgSettings.tsx) hoặc trang riêng `/org/:slug/audit-log`: tab/section "Lịch sử thao tác".
- Filter theo: loại action, thời gian (date range), người thực hiện.
- Endpoint: tái dùng hoặc mở rộng API audit hiện có, filter thêm theo `targetType IN ('Assessment', 'CandidateInvite')`.

#### FR-6.3 Không audit thao tác đọc

- `GET` (xem danh sách, xem kết quả) không ghi audit — chỉ ghi thao tác ghi/quyết định.

---

## 4. Yêu cầu phi chức năng

| ID | Yêu cầu |
|---|---|
| NFR-1 (Hiệu năng PDF) | PDF generation < 3s cho report 1 trang; endpoint chặn đồng bộ (không cần job queue ở P3). |
| NFR-2 (Email delivery) | Email gửi trong BullMQ job (không block request); timeout 10s/job; retry 3 lần với backoff. |
| NFR-3 (Anonymization idempotency) | Cron có thể chạy lại nhiều lần mà không double-anonymize (guard bằng `anonymizedAt IS NULL`). |
| NFR-4 (Audit immutability) | `AuditLog` chỉ INSERT, không UPDATE/DELETE. Không cần bảo vệ thêm ở P3. |
| NFR-5 (Branding graceful degradation) | Nếu `logoUrl` không tải được (404/timeout) → template dùng org name text thay thế, không crash email. |
| NFR-6 (Security PDF) | Endpoint PDF phải qua `JwtAuthGuard + OrgRoleGuard`; file không được cache public. |
| NFR-7 (GDPR minimal data in logs) | Audit log `metadata` không được lưu full email của ứng viên; chỉ lưu `inviteId` và `assessmentId`. |
| NFR-8 (A11y) | Trang CandidateExam với branding org vẫn phải đạt Lighthouse a11y ≥ 95 (contrast check với `accentColor`). |

---

## 5. Thay đổi schema Prisma

### 5.1. `Organization` — thêm fields

```prisma
model Organization {
  // ... fields hiện có ...
  retentionDays     Int     @default(365)  @map("retention_days")
  sendResultEmail   Boolean @default(false) @map("send_result_email") // nếu muốn per-org default
}
```

> `logoUrl` và `accentColor` đã có — không thêm mới.

### 5.2. `Assessment` — thêm fields

```prisma
model Assessment {
  // ... fields hiện có ...
  sendResultEmail   Boolean @default(false) @map("send_result_email")
  sendReminderEmail Boolean @default(true)  @map("send_reminder_email")
}
```

### 5.3. `CandidateInvite` — thêm fields

```prisma
model CandidateInvite {
  // ... fields hiện có ...
  reminderSentAt DateTime? @map("reminder_sent_at")
  anonymizedAt   DateTime? @map("anonymized_at")
}
```

### 5.4. Migration

Một migration nhỏ:
```
npx prisma migrate dev --name p3_branding_email_compliance
```
Không phá vỡ schema hiện tại (tất cả là optional hoặc có default).

---

## 6. Thiết kế API

### 6.1. Branding trong response public

**Mở rộng** `GET /assessments/take/:token` (đã có):
```jsonc
// Response hiện tại + thêm:
{
  "id": "...",
  "title": "Senior Backend Engineer — Technical Screen",
  // ...
  "branding": {
    "orgName": "Acme Corp",
    "logoUrl": "https://cdn.example.com/acme-logo.png",
    "accentColor": "#1a56db"
  }
}
```

### 6.2. PDF export

```
GET /organizations/:orgId/assessments/:aid/candidates/:inviteId/pdf
Headers:
  Authorization: Bearer <token>
Response:
  Content-Type: application/pdf
  Content-Disposition: attachment; filename="result-{inviteId}.pdf"
  Body: <binary PDF>
```

Lỗi:
- `403` — không có quyền.
- `400` — ứng viên chưa submit.
- `404` — invite không tồn tại trong assessment/org này.

### 6.3. Anonymize PII

```
DELETE /organizations/:orgId/assessments/:aid/candidates/:inviteId/pii
Headers:
  Authorization: Bearer <token>   (OWNER or ADMIN)
Response 200:
{
  "inviteId": "...",
  "anonymizedAt": "2026-06-05T10:00:00Z"
}
```

### 6.4. Audit log (tái dùng pattern hiện có)

```
GET /organizations/:orgId/audit-logs?targetType=Assessment,CandidateInvite&from=2026-01-01&to=2026-06-30&page=1&limit=50
Headers:
  Authorization: Bearer <token>   (OWNER or ADMIN)
Response:
{
  "data": [
    { "id": "...", "action": "CANDIDATE_INVITED", "targetType": "CandidateInvite", "targetId": "...", "metadata": { "assessmentId": "..." }, "createdAt": "...", "user": { "id": "...", "displayName": "..." } }
  ],
  "total": 120,
  "page": 1,
  "limit": 50
}
```

---

## 7. Ảnh hưởng các file hiện có

### 7.1. Backend

| File | Thay đổi |
|---|---|
| `backend/prisma/schema.prisma` | Thêm fields `retentionDays`, `sendResultEmail`, `sendReminderEmail`, `reminderSentAt`, `anonymizedAt` |
| `backend/src/mail/mail.service.ts` | Refactor `sendAssessmentInvite()` nhận thêm `branding` object; thêm `sendAssessmentReminder()`, `sendAssessmentResult()` |
| `backend/src/assessments/candidate.controller.ts` | `GET /take/:token` — include branding trong response |
| `backend/src/assessments/candidate.service.ts` | `submitAttempt()` — trigger result email nếu `assessment.sendResultEmail` |
| `backend/src/assessments/assessments.controller.ts` | Thêm `GET .../candidates/:inviteId/pdf`, `DELETE .../candidates/:inviteId/pii` |
| `backend/src/assessments/assessments.service.ts` | Logic generate PDF, logic anonymize PII, ghi audit log |
| `backend/src/assessments/dto/create-assessment.dto.ts` | Thêm `sendResultEmail`, `sendReminderEmail` |
| `backend/src/organizations/dto/update-org.dto.ts` | Thêm `retentionDays` (validate min 30) |

### 7.2. Backend — files mới

| File | Nội dung |
|---|---|
| `backend/src/assessments/pdf.service.ts` | Generate PDF từ invite data; inject `pdfkit` hoặc `puppeteer` |
| `backend/src/assessments/mail-templates/assessment-invite.html` | Branded HTML template (Handlebars hoặc string interpolation) |
| `backend/src/assessments/mail-templates/assessment-reminder.html` | Template nhắc hạn |
| `backend/src/assessments/mail-templates/assessment-result.html` | Template kết quả |
| `backend/src/cron/assessment-reminder.cron.ts` | BullMQ scheduled job hoặc NestJS `@Cron` — gửi reminder 24h |
| `backend/src/cron/candidate-retention.cron.ts` | BullMQ scheduled job hoặc NestJS `@Cron` — anonymize PII |

### 7.3. Frontend

| File | Thay đổi |
|---|---|
| `src/pages/CandidateExam.tsx` | Đọc `branding` từ response, áp logo + accentColor lên header + UI elements |
| `src/pages/CandidateResult.tsx` | Áp cùng branding context |
| `src/pages/org/AssessmentResults.tsx` | Thêm nút "Export PDF" trong drawer chi tiết; badge "Đã ẩn danh"; action "Xóa PII" cho Admin |
| `src/pages/org/OrgSettings.tsx` | Tab/section "Tuân thủ": input `retentionDays`; toggle `sendResultEmail` per-org default |
| `src/pages/org/AssessmentBuilder.tsx` | Thêm toggle `sendResultEmail`, `sendReminderEmail` trong cài đặt assessment |

### 7.4. Frontend — files mới

| File | Nội dung |
|---|---|
| `src/pages/org/OrgAuditLog.tsx` | Trang audit log với filter và bảng sự kiện |
| `src/services/compliance.ts` | API client: PDF export, delete PII, audit log query |

---

## 8. Kế hoạch triển khai theo giai đoạn

| Phase | Nội dung | FR bao phủ |
|---|---|---|
| **P1 (MVP)** | Branded email templates (invite) · Branding trên CandidateExam · PDF export · Retention anonymization cron · Audit log 8 actions | FR-1.1–1.2 (invite only), FR-2, FR-3, FR-5, FR-6 |
| **P2** | Reminder email cron · Result email · Cấu hình per-assessment · Endpoint xóa PII · Audit log UI | FR-1.3, FR-1.4 (result), FR-4, FR-5.3–5.4, FR-6.2 |

---

## 9. Tiêu chí chấp nhận (Acceptance Criteria)

### AC-1 — Branded invite email (FR-1, FR-2)
- [ ] Tạo `CandidateInvite` cho org có `logoUrl = "https://example.com/logo.png"` và `accentColor = "#1a56db"` → email gửi (Mailtrap) có `<img src="https://example.com/logo.png">` và nút CTA màu `#1a56db`.
- [ ] Org không có `logoUrl` → email hiển thị tên org dạng text, không có broken image.
- [ ] Trang `/assess/:token` load branding của org: logo header, accent color trên nút "Bắt đầu làm bài".

### AC-2 — PDF export (FR-3)
- [ ] Recruiter nhấn "Export PDF" với invite đã SUBMITTED → tải về file `.pdf` hợp lệ mở được.
- [ ] PDF chứa: tên assessment, điểm tổng, pass/fail, domain breakdown, integrity score, timestamp.
- [ ] Invite `status = INVITED` (chưa làm) → nút disable hoặc gọi API trả `400`.
- [ ] User không phải OWNER/ADMIN/MANAGER/RECRUITER gọi endpoint → `403`.

### AC-3 — Anonymization (FR-5)
- [ ] Set `retentionDays = 30` cho org. Sau khi fake `submittedAt` là 31 ngày trước và chạy cron thủ công → `candidateEmail = 'anonymized@example.com'`, `candidateName = null`, `ipAddress = null`, `anonymizedAt != null`.
- [ ] Score, domainScores, integrityScore, stage giữ nguyên sau anonymization.
- [ ] Cron chạy lại → không thay đổi gì (idempotent).
- [ ] Endpoint `DELETE .../pii` gọi bởi Admin → anonymize ngay, không chờ cron.

### AC-4 — Audit log (FR-6)
- [ ] Tạo assessment → xuất hiện `ASSESSMENT_CREATED` trong audit log với đúng `targetId`.
- [ ] Đổi stage ứng viên → xuất hiện `CANDIDATE_STAGE_UPDATED`.
- [ ] Export PDF → xuất hiện `PDF_EXPORTED`.
- [ ] `GET` danh sách kết quả → **không** xuất hiện bất kỳ log nào.
- [ ] Audit log `metadata` không chứa full email ứng viên.

### AC-5 — Branding graceful degradation (NFR-5, NFR-8)
- [ ] `logoUrl` trả 404 → email không crash, hiển thị orgName dạng text.
- [ ] `accentColor = "#000000"` (màu tối) → Lighthouse a11y vẫn ≥ 90 (text trên nền dark button đủ contrast).

---

## 10. Rủi ro & vấn đề mở

| # | Rủi ro | Hướng xử lý |
|---|---|---|
| R-1 | PDF library trong Docker: `puppeteer` cần Chromium — image có thể phình to | Dùng `pdfkit` (pure Node) cho MVP; migrate sang puppeteer nếu cần layout phức tạp. Cần confirm với DevOps trước khi chọn. |
| R-2 | Email branding: inline CSS bị mail client cắt (Gmail cắt style > 102KB) | Dùng inline styles trực tiếp, không import stylesheet ngoài. Template phải nhẹ < 50KB. |
| R-3 | Retention cron quét toàn bộ table lớn mỗi ngày | Index `(submitted_at, anonymized_at)` để scan hiệu quả; xử lý theo batch 500 rows/lần. |
| R-4 | Org không upload logo → branding không khác gì Brain Gym mặc định | Thêm hướng dẫn trong OrgSettings + reminder "Chưa cấu hình logo — email sẽ hiển thị tên org". |
| R-5 | Ứng viên EU yêu cầu xóa dữ liệu (GDPR Article 17) nhưng không có tài khoản | Documented workaround: ứng viên gửi email → Admin org trigger `DELETE .../pii` endpoint. Cần hướng dẫn trong help center. |
| R-6 | `accentColor` người dùng nhập tạo contrast không đủ a11y | Validate hex format trong OrgSettings; hiển thị preview + cảnh báo nếu contrast < WCAG AA với màu trắng. |

---

## 11. Liên kết tài liệu

- **Enterprise plan tổng quan**: [enterprise-entrance-exam-plan.md](../enterprise-entrance-exam-plan.md)
- **Schema Prisma**: [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma)
- **Mail service**: [backend/src/mail/mail.service.ts](../../backend/src/mail/mail.service.ts)
- **Candidate controller**: [backend/src/assessments/candidate.controller.ts](../../backend/src/assessments/candidate.controller.ts)
- **AssessmentResults FE**: [src/pages/org/AssessmentResults.tsx](../../src/pages/org/AssessmentResults.tsx)
- **CandidateExam FE**: [src/pages/CandidateExam.tsx](../../src/pages/CandidateExam.tsx)
- **A11y baseline**: [docs/a11y-baseline.md](../a11y-baseline.md)
- **SRS P0 reference (Smart Builder)**: [docs/specs/smart-exam-builder-srs.md](./smart-exam-builder-srs.md)

---

*Tài liệu này ở trạng thái Draft để review. Sau khi chốt D1–D5 (§2.4) và AC được team approve, sẽ chuyển sang thiết kế chi tiết và lập kế hoạch sprint.*
