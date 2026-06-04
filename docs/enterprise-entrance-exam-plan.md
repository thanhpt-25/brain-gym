# Enterprise Entrance-Exam — Upgrade Plan (P0–P3)

> Nâng cấp tính năng **Organization** thành một giải pháp enterprise để doanh nghiệp tạo & quản lý **bài kiểm tra đầu vào** (tuyển dụng / sàng lọc / onboarding) cho ứng viên.

**Status:** Draft for review · **Author:** —  · **Date:** 2026-06-04

---

## 0. Bối cảnh & Hiện trạng

Phần lớn nền tảng đã tồn tại. Luồng "kiểm tra đầu vào" hiện được hiện thực qua bộ model **Candidate Assessment**:

| Thành phần | Vị trí | Vai trò |
|---|---|---|
| `Assessment` / `AssessmentQuestion` | [schema.prisma:1010](../backend/prisma/schema.prisma) | Đề kiểm tra của org cho ứng viên ngoài |
| `CandidateInvite` / `CandidateAnswer` | [schema.prisma:1049](../backend/prisma/schema.prisma) | Lời mời theo email + token, bài làm, điểm |
| Backend service | [assessments.service.ts](../backend/src/assessments/assessments.service.ts), [candidate.service.ts](../backend/src/assessments/candidate.service.ts) | CRUD, invite, results, export CSV; load/start/submit |
| Frontend admin | [AssessmentBuilder.tsx](../src/pages/org/AssessmentBuilder.tsx), [OrgAssessments.tsx](../src/pages/org/OrgAssessments.tsx), [AssessmentResults.tsx](../src/pages/org/AssessmentResults.tsx) | Tạo đề, danh sách, kết quả |
| Frontend candidate | `CandidateExam` / `CandidateResult` ([App.tsx:397](../src/App.tsx)) | Trang công khai làm bài, không cần auth |
| Ngân hàng câu hỏi | `OrgQuestion` (workflow `DRAFT→UNDER_REVIEW→APPROVED→REJECTED`) | Nguồn câu hỏi riêng của org |

**Đã có:** chấm điểm tự động, `domainScores`, `passingScore`, funnel (invited→started→submitted→passed), randomize câu/đáp án, `detectTabSwitch`, `blockCopyPaste`, `linkExpiryHours`, `tabSwitchCount`, `ipAddress`, export CSV.

**Còn thiếu để dùng cho doanh nghiệp thật:** tạo đề thông minh theo blueprint/pool, quy trình tuyển dụng (ATS-lite), phân quyền recruiter, proctoring nghiêm túc, email branded thật, báo cáo & tuân thủ dữ liệu.

### Nguyên tắc thiết kế
- **Tái sử dụng tối đa**: dựng trên `Assessment`/`CandidateInvite`, không tạo trục song song.
- **Mỗi phase deploy độc lập**, có migration riêng, không phá vỡ luồng hiện tại (backward-compatible defaults).
- Tôn trọng quy ước codebase: TanStack Query cho server state, Zustand cho client state, loose TS (`strictNullChecks: false`), guard `org-role.guard.ts`.

---

## P0 — Smart Assessment Builder

> **Mục tiêu:** Cho phép tạo đề tự động theo blueprint domain-% hoặc rút ngẫu nhiên từ pool, mỗi ứng viên một đề khác nhau. Tận dụng logic blueprint đã làm ở #69/#70.

### User stories
- **US-P0-1** — Là Admin org, tôi chọn chế độ tạo đề: *Thủ công* / *Blueprint theo % domain* / *Pool ngẫu nhiên*, để không phải chọn tay từng câu.
- **US-P0-2** — Là Admin, với Blueprint tôi nhập tổng số câu + tỷ lệ % mỗi domain; hệ thống tự rút từ `OrgQuestion` đã `APPROVED`.
- **US-P0-3** — Là Admin, với Pool tôi định nghĩa filter (certification, tags, difficulty) + số câu rút; **mỗi ứng viên nhận một bộ câu ngẫu nhiên khác nhau** từ pool.
- **US-P0-4** — Là Admin, tôi thấy cảnh báo nếu pool/blueprint không đủ câu hỏi cho cấu hình.

### Data model (Prisma)
```prisma
enum AssessmentSelectionMode {
  MANUAL      // hiện tại — danh sách câu cố định
  BLUEPRINT   // auto-build 1 đề cố định theo % domain lúc tạo
  POOL        // rút ngẫu nhiên N câu mỗi ứng viên lúc startAttempt
}

model Assessment {
  // ... fields hiện có
  selectionMode AssessmentSelectionMode @default(MANUAL) @map("selection_mode")
  // Cấu hình blueprint/pool, dạng JSON để linh hoạt:
  // BLUEPRINT: { totalQuestions, domains: [{ domain, percentage }], difficulty? }
  // POOL:      { drawCount, certificationId?, tags?: string[], difficulty?, domains?: [...] }
  selectionConfig Json? @map("selection_config")
}
```
- MANUAL/BLUEPRINT: vẫn vật chất hoá qua `AssessmentQuestion` (BLUEPRINT build 1 lần lúc tạo) → không đổi `candidate.service`.
- POOL: **không** vật chất hoá; lưu `selectionConfig`. `CandidateInvite` cần lưu bộ câu đã rút để tái lập khi reload:
```prisma
model CandidateInvite {
  // ...
  drawnQuestionIds String[] @default([]) @map("drawn_question_ids") // POOL: snapshot câu đã rút
}
```

### Backend
- `create-assessment.dto.ts`: thêm `selectionMode`, `selectionConfig` (validate theo mode). Khi BLUEPRINT → service gọi lại logic phân bổ domain-% (trích xuất từ Smart Exam Builder #70 thành helper dùng chung, ví dụ `blueprint.util.ts`), query `OrgQuestion` `status=APPROVED` theo org, rút câu, ghi `AssessmentQuestion`.
- `candidate.service.ts › buildQuestionPayload` ([candidate.service.ts:214](../backend/src/assessments/candidate.service.ts)): nếu `selectionMode=POOL` và `invite.drawnQuestionIds` rỗng → rút ngẫu nhiên từ pool theo `selectionConfig`, lưu vào `drawnQuestionIds` (idempotent: lần sau dùng lại snapshot).
- Validation: nếu số câu khả dụng < yêu cầu → ném `BadRequestException` (US-P0-4); endpoint preview đếm câu khả dụng cho UI.
- Endpoint mới (tùy chọn): `GET /orgs/:slug/assessments/pool-count?config=...` trả số câu khả dụng.

### Frontend
- [AssessmentBuilder.tsx](../src/pages/org/AssessmentBuilder.tsx): thêm tab/segmented control 3 mode. Tái dùng UI blueprint từ Smart Exam Builder (component nhập % domain) nếu đã tách được; nếu chưa, refactor thành component dùng chung `BlueprintDomainEditor`.
- Hiển thị "X/Y câu khả dụng" realtime; disable submit nếu không đủ.
- `assessment-types.ts` + `services/assessments.ts`: thêm `selectionMode`, `selectionConfig` vào payload/types.

### Acceptance criteria
- [ ] Tạo assessment BLUEPRINT 20 câu (50% Domain A, 50% Domain B) → `AssessmentQuestion` có đúng 10+10 câu APPROVED.
- [ ] Tạo assessment POOL drawCount=15 → 2 ứng viên khác nhau nhận 2 bộ câu khác nhau; reload cùng token → cùng bộ câu.
- [ ] Cấu hình vượt số câu khả dụng → lỗi rõ ràng ở UI, không tạo được.
- [ ] MANUAL giữ nguyên hành vi cũ (regression).

---

## P1 — Recruiting Workflow (ATS-lite)

> **Mục tiêu:** Biến danh sách "candidate invites" thành pipeline tuyển dụng có vị trí, giai đoạn, quyết định, ghi chú, xếp hạng.

### User stories
- **US-P1-1** — Là Recruiter, tôi gắn mỗi assessment với một **vị trí tuyển dụng** (Job Role) để nhóm ứng viên theo vị trí.
- **US-P1-2** — Là Recruiter, tôi xem bảng ứng viên có **xếp hạng theo điểm + percentile**, lọc theo trạng thái, sắp xếp.
- **US-P1-3** — Là Recruiter, tôi đánh dấu ứng viên `SHORTLISTED / REJECTED / HIRED`, chấm sao (rating) và ghi chú nội bộ.
- **US-P1-4** — Là Recruiter, tôi **import danh sách ứng viên từ CSV** để mời hàng loạt.
- **US-P1-5** — Là Owner/Admin, tôi gán role **RECRUITER** cho thành viên — chỉ thấy assessment & ứng viên, không sửa được question bank/settings.

### Data model
```prisma
enum OrgRole {
  OWNER
  ADMIN
  MANAGER
  RECRUITER   // mới: chỉ assessment & candidates
  MEMBER
}

enum CandidateStage {
  APPLIED
  SCREENING
  SHORTLISTED
  REJECTED
  HIRED
}

model JobRole {
  id          String   @id @default(uuid())
  orgId       String   @map("org_id")
  title       String
  department  String?
  description String?
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  assessments  Assessment[]
  @@map("job_roles")
}

model Assessment {
  // ...
  jobRoleId String? @map("job_role_id")
  jobRole   JobRole? @relation(fields: [jobRoleId], references: [id])
}

model CandidateInvite {
  // ...
  stage         CandidateStage @default(APPLIED)
  rating        Int?           // 1..5, đánh giá thủ công
  recruiterNote String?        @map("recruiter_note")
  decidedBy     String?        @map("decided_by")
  decidedAt     DateTime?      @map("decided_at")
}
```

### Backend
- Module mới `job-roles` (CRUD, guard ADMIN/OWNER).
- `org-roles.decorator.ts` + `org-role.guard.ts`: thêm `RECRUITER`; định nghĩa ma trận quyền (RECRUITER cho phép: list/get/create assessment, invite, results, cập nhật stage/rating/note; chặn: org settings, members admin, question bank ghi).
- `candidate` / `assessment` service: endpoint `PATCH /assessments/:aid/candidates/:inviteId` (stage, rating, note), tính percentile trong `getResults`.
- Bulk import: `POST /assessments/:aid/invite` nhận mảng từ CSV (đã có `inviteCandidates`, mở rộng nhận file/parse phía FE).

### Frontend
- [AssessmentResults.tsx](../src/pages/org/AssessmentResults.tsx): nâng cấp thành bảng ứng viên đầy đủ — cột điểm, percentile, stage (badge), rating, action menu (shortlist/reject/hire), drawer chi tiết + ghi chú.
- Trang/section **Job Roles** trong org; selector job role trong AssessmentBuilder.
- CSV import dialog (parse client-side, preview, gửi bulk).
- Ẩn các mục điều hướng question bank/settings khi `myRole === 'RECRUITER'`.

### Acceptance criteria
- [ ] RECRUITER đăng nhập chỉ thấy Assessments + Candidates, gọi API question-bank ghi → 403.
- [ ] Bảng ứng viên xếp hạng đúng theo điểm, hiển thị percentile.
- [ ] Đổi stage → REJECTED lưu `decidedBy/decidedAt`, phản ánh ở funnel.
- [ ] Import CSV 50 dòng → tạo 50 invite, báo lỗi dòng email sai.

---

## P2 — Proctoring & Integrity

> **Mục tiêu:** Tăng độ tin cậy cho bài thi đầu vào nghiêm túc: chống gian lận, xác thực danh tính, điểm liêm chính.

### User stories
- **US-P2-1** — Là Admin, tôi bật **fullscreen bắt buộc**; thoát fullscreen bị cảnh báo và ghi log.
- **US-P2-2** — Là ứng viên, tôi xác thực email bằng **OTP** trước khi vào làm bài.
- **US-P2-3** — Hệ thống đảm bảo **một token chỉ làm được một lần** (chống làm lại/chia sẻ link).
- **US-P2-4** — Là Recruiter, tôi thấy **Integrity Score** + timeline sự kiện (tab switch, mất focus, copy, thời gian/câu bất thường) của mỗi ứng viên.

### Data model
- Tái dùng `AttemptEvent` ([schema.prisma:1087](../backend/prisma/schema.prisma)) cho candidate (thêm liên kết `inviteId` hoặc bảng `CandidateEvent` tương tự nếu `AttemptEvent` gắn chặt `ExamAttempt`).
```prisma
model Assessment {
  // ...
  requireFullscreen Boolean @default(false) @map("require_fullscreen")
  requireOtp        Boolean @default(false) @map("require_otp")
  maxAttempts       Int     @default(1)     @map("max_attempts")
}
model CandidateInvite {
  // ...
  integrityScore Int?     @map("integrity_score") // 0..100, tính tự động
  otpVerifiedAt  DateTime? @map("otp_verified_at")
}
```

### Backend
- `candidate.service.ts › startAttempt`: chặn nếu `status != INVITED` hoặc đã `SUBMITTED` (enforce 1 lần, US-P2-3 — hiện đã có một phần, siết chặt + maxAttempts).
- OTP: `POST /candidate/:token/otp/request` (gửi mã qua email), `POST /candidate/:token/otp/verify`. Lưu hash OTP + hạn dùng (Redis hợp lý cho TTL).
- `reportEvent` ([candidate.service.ts:182](../backend/src/assessments/candidate.service.ts)): mở rộng loại sự kiện (FULLSCREEN_EXIT, BLUR, COPY, PASTE, FAST_ANSWER). Khi submit, tính `integrityScore` = 100 − trọng số vi phạm.

### Frontend (CandidateExam)
- Fullscreen API: yêu cầu fullscreen lúc start; bắt sự kiện exit → cảnh báo + `reportEvent`.
- Màn OTP trước khi load đề (nếu `requireOtp`).
- AssessmentResults: hiển thị Integrity Score (badge màu) + timeline sự kiện trong drawer chi tiết.

### Acceptance criteria
- [ ] Token đã SUBMITTED mở lại → bị chặn, không cho làm lại.
- [ ] requireOtp bật: phải nhập OTP đúng mới vào; OTP hết hạn → từ chối.
- [ ] Thoát fullscreen ghi event, hiển thị ở timeline.
- [ ] Integrity Score giảm khi có nhiều tab-switch/copy.

---

## P3 — Branding, Email & Compliance

> **Mục tiêu:** Trải nghiệm chuyên nghiệp & tuân thủ dữ liệu cho doanh nghiệp.

### User stories
- **US-P3-1** — Là ứng viên, email mời/nhắc/kết quả mang **thương hiệu org** (logo, màu, tên) và là email **gửi thật**.
- **US-P3-2** — Là ứng viên, trang làm bài hiển thị logo & màu của org.
- **US-P3-3** — Là Recruiter, tôi xuất **báo cáo PDF** kết quả của một ứng viên.
- **US-P3-4** — Là Owner, dữ liệu ứng viên tuân thủ **retention/ẩn danh** (GDPR): tự xoá/ẩn danh sau N ngày, ứng viên yêu cầu xoá.
- **US-P3-5** — Là Admin, mọi thao tác trên assessment được **ghi audit log**.

### Backend
- Email service branded: template (mời/nhắc hạn/kết quả) dùng `org.logoUrl`/`accentColor`/`name`. Tích hợp provider thật (Mailtrap dev → Gmail/SES prod theo [organization.md](organization.md)). Job nhắc hạn (cron) trước khi `expiresAt`.
- PDF per-candidate: render server-side (hoặc client) từ `getResults` của một invite.
- Retention: cron ẩn danh `candidateEmail/candidateName/ipAddress` sau `retentionDays` (cấu hình org); endpoint xoá theo yêu cầu ứng viên.
- Audit log: tái dùng hệ thống audit hiện có (Admin có `OrgAuditLog`) cho create/update/status/invite/decision.

### Frontend
- CandidateExam/CandidateResult: áp branding org (logo header, accent color).
- AssessmentResults: nút "Export PDF" per-candidate; phần cấu hình retention trong OrgSettings.
- OrgAuditLog: hiển thị sự kiện assessment.

### Acceptance criteria
- [ ] Mời ứng viên → email thật đến hộp thư (Mailtrap dev), có logo/màu org.
- [ ] Export PDF của 1 ứng viên ra file hợp lệ (điểm, domain breakdown, integrity).
- [ ] Sau retentionDays, PII ứng viên bị ẩn danh; điểm/aggregate vẫn giữ.
- [ ] Mọi thao tác assessment xuất hiện trong audit log.

---

## Tổng hợp ưu tiên & phụ thuộc

| Phase | Giá trị | Effort | Phụ thuộc | Migration |
|---|---|---|---|---|
| **P0** Smart Builder | ★★★ | Vừa (tái dùng #70) | — | `selection_mode`, `selection_config`, `drawn_question_ids` |
| **P1** ATS-lite | ★★★ | Lớn | P0 nên có | `job_roles`, role RECRUITER, fields `CandidateInvite` |
| **P2** Proctoring | ★★ | Vừa–Lớn | P1 (để xem integrity) | fields proctoring + OTP |
| **P3** Branding/Compliance | ★★ | Vừa | Email infra | retention, audit |

**Khuyến nghị thứ tự ship:** P0 → P1 → P2 → P3. P0 mang giá trị tức thì và rủi ro thấp nhất (chủ yếu tái dùng code blueprint sẵn có).

### Rủi ro & lưu ý
- **Nguồn câu hỏi:** Blueprint/Pool phụ thuộc số lượng `OrgQuestion` `APPROVED` đủ lớn theo domain. Cần khuyến khích org xây dựng question bank trước (có thể nối với AI generation sẵn có).
- **POOL snapshot:** bắt buộc lưu `drawnQuestionIds` để tránh đổi đề khi ứng viên reload — đã xử lý ở P0.
- **Bảo mật token:** P2 siết 1-lần-làm + OTP là điều kiện để dùng cho tuyển dụng thật.
- **GDPR:** nếu phục vụ ứng viên EU, P3 retention là bắt buộc, không phải tùy chọn.
- **Tách helper blueprint:** cần refactor logic Smart Exam Builder (#70) thành util dùng chung trước P0 để tránh trùng lặp.
