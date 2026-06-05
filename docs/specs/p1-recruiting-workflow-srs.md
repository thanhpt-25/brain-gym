# SRS — P1: Recruiting Workflow (ATS-lite)

| | |
|---|---|
| **Tài liệu** | Software Requirements Specification (SRS) |
| **Tính năng** | P1 — Recruiting Workflow (ATS-lite) |
| **Phiên bản** | 1.0 (Implemented) |
| **Ngày** | 2026-06-05 |
| **Trạng thái** | Đã triển khai — tài liệu hóa sau implement |
| **Phụ thuộc** | P0 (Smart Assessment Builder) — nên có trước |
| **Module liên quan** | `assessments`, `organizations` (backend) · `AssessmentResults.tsx`, `CandidateRanking.tsx` (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Tài liệu này đặc tả yêu cầu cho **P1 — Recruiting Workflow (ATS-lite)**, biến danh sách invite ứng viên thành một pipeline tuyển dụng đơn giản. Admin/Recruiter có thể gắn assessment với vị trí tuyển dụng (Job Role), xem xếp hạng ứng viên, đánh dấu quyết định (shortlist/reject/hire), import hàng loạt từ CSV, và phân quyền RECRUITER riêng biệt.

### 1.2. Phạm vi

**Trong phạm vi:**
- Role `RECRUITER` cho org member — quyền hạn chế chỉ đọc/ghi assessment & candidates.
- Model `JobRole` — vị trí tuyển dụng gắn với assessment.
- Pipeline stage cho `CandidateInvite`: APPLIED → SCREENING → SHORTLISTED → REJECTED / HIRED.
- Recruiter rating (1–5 sao) và ghi chú nội bộ.
- Tính toán và hiển thị percentile theo điểm trong cùng assessment.
- Bulk import ứng viên từ CSV (client-side parse).
- Export kết quả ra CSV (mở rộng từ export đã có).
- Frontend: bảng ứng viên đầy đủ với drawer chi tiết, stage pipeline summary.

**Ngoài phạm vi:**
- Tích hợp ATS bên ngoài (Greenhouse, Lever, Workday).
- Email thông báo khi stage thay đổi (thuộc P3).
- Lịch phỏng vấn / calendar integration.
- Scorecard / structured interview templates.

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| **RECRUITER** | Org role mới — chỉ xem/quản lý assessment & candidates; không sửa question bank, org settings, members |
| **JobRole** | Vị trí tuyển dụng (tên + department) gắn với một hoặc nhiều assessment |
| **CandidateStage** | Trạng thái trong pipeline tuyển dụng của ứng viên |
| **Percentile** | Xếp hạng điểm của ứng viên so với toàn bộ ứng viên SUBMITTED cùng assessment (0–100) |
| **Decision** | Hành động recruiter: cập nhật stage thành SHORTLISTED / REJECTED / HIRED + ghi chú |

### 1.4. Hiện trạng trước P1

- Không có khái niệm vị trí tuyển dụng.
- Danh sách invite chỉ có: email, điểm, trạng thái — không có pipeline.
- Tất cả member đều dùng chung role OWNER/ADMIN/MANAGER/MEMBER; không có role chuyên cho recruiter.
- Không có bulk import.

---

## 2. Mô tả tổng quan

### 2.1. Bối cảnh sản phẩm

Doanh nghiệp thường có HR/Recruiter không phải technical person — họ cần xem điểm thi, ra quyết định shortlist/reject, nhưng không được quyền chỉnh đề thi hay cài đặt org. P1 tạo role và UI phù hợp cho nhóm người dùng này.

### 2.2. Nhóm người dùng

| Vai trò | Nhu cầu P1 |
|---|---|
| **Owner / Admin** | Gán role RECRUITER cho member HR; tạo JobRole; xem toàn bộ pipeline |
| **Recruiter** | Xem bảng ứng viên xếp hạng; đổi stage; ghi chú; import CSV |
| **Manager** | Tạo assessment gắn JobRole; xem kết quả |

---

## 3. Yêu cầu chức năng

### FR-1 — RECRUITER org role

**FR-1.1**: Thêm `RECRUITER` vào enum `OrgRole`. Thứ tự: OWNER > ADMIN > MANAGER > RECRUITER > MEMBER.

**FR-1.2**: Ma trận quyền RECRUITER:

| Endpoint | Allowed |
|---|---|
| `GET /organizations/:orgId/assessments` | ✅ |
| `POST /organizations/:orgId/assessments` | ✅ |
| `GET /organizations/:orgId/assessments/:aid` | ✅ |
| `PATCH /organizations/:orgId/assessments/:aid` | ✅ |
| `POST /organizations/:orgId/assessments/:aid/invite` | ✅ |
| `GET /organizations/:orgId/assessments/:aid/results` | ✅ |
| `GET /organizations/:orgId/assessments/:aid/results/export` | ✅ |
| `PATCH /organizations/:orgId/assessments/:aid/candidates/:inviteId` | ✅ |
| `GET /organizations/:orgId/questions/**` (ghi) | ❌ 403 |
| `PATCH /organizations/:orgId` (org settings) | ❌ 403 |
| `POST /organizations/:orgId/members/invite` | ❌ 403 |

**FR-1.3**: `OrgRoleGuard` sử dụng `@OrgRoles('OWNER', 'ADMIN', 'MANAGER', 'RECRUITER')` cho assessment endpoints.

**FR-1.4**: RECRUITER không thấy menu "Question Bank", "Settings", "Members" trong sidebar org.

---

### FR-2 — Job Role

**FR-2.1**: Model `JobRole`:

```prisma
model JobRole {
  id           String   @id @default(uuid())
  orgId        String   @map("org_id")
  title        String
  department   String?
  description  String?
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  organization Organization @relation(...)
  assessments  Assessment[]
  @@map("job_roles")
}
```

**FR-2.2**: `Assessment` có field `jobRoleId String? @map("job_role_id")` — optional, nullable.

**FR-2.3**: Endpoints JobRole (guard: OWNER, ADMIN, MANAGER):
- `GET /organizations/:orgId/job-roles` — list active job roles.
- `POST /organizations/:orgId/job-roles` — tạo mới.
- `PATCH /organizations/:orgId/job-roles/:jid` — sửa.
- `DELETE /organizations/:orgId/job-roles/:jid` (soft: `isActive = false`).

**FR-2.4**: `CreateAssessmentDto` / `UpdateAssessmentDto` có field `jobRoleId?: string`.

**FR-2.5**: Response `GET /assessments/:aid` include `jobRole: { id, title, department }`.

---

### FR-3 — CandidateStage pipeline

**FR-3.1**: Enum `CandidateStage`: `APPLIED | SCREENING | SHORTLISTED | REJECTED | HIRED`.

**FR-3.2**: `CandidateInvite` thêm fields:

```prisma
stage         CandidateStage @default(APPLIED)
rating        Int?           // 1–5
recruiterNote String?        @map("recruiter_note")
decidedBy     String?        @map("decided_by")   // userId
decidedAt     DateTime?      @map("decided_at")
```

**FR-3.3**: Khi stage chuyển sang `HIRED`, `REJECTED`, hoặc `SHORTLISTED` → set `decidedBy = userId` người thực hiện, `decidedAt = now()`.

**FR-3.4**: Endpoint cập nhật decision:

```
PATCH /organizations/:orgId/assessments/:aid/candidates/:inviteId
Body: { stage?, rating?, recruiterNote? }
Guard: OrgRole(OWNER, ADMIN, MANAGER, RECRUITER)
```

**FR-3.5**: Không có ràng buộc transition (có thể nhảy từ APPLIED thẳng sang HIRED).

---

### FR-4 — Xếp hạng & Percentile

**FR-4.1**: `GET /organizations/:orgId/assessments/:aid/results` tính `percentile` cho mỗi invite có `status = SUBMITTED`.

**FR-4.2**: Công thức: `percentile = Math.round((rank_below_or_equal - 1) / total_submitted * 100)` — ứng viên điểm cao nhất = percentile cao nhất.

**FR-4.3**: Invite chưa submit → `percentile = null`.

**FR-4.4**: Frontend hiển thị percentile dạng "82nd" trong cột bảng và drawer chi tiết.

---

### FR-5 — Bulk import ứng viên từ CSV

**FR-5.1**: Frontend có modal "Import CSV" (`CsvImportModal`):
- Chọn file `.csv`; parse client-side.
- CSV format: `name,email` (header row optional, detect tự động).
- Preview danh sách với highlight dòng lỗi (email không hợp lệ, thiếu email, duplicate).

**FR-5.2**: Submit → gọi `POST /organizations/:orgId/assessments/:aid/invite` với mảng `[{ name, email }]`.

**FR-5.3**: Backend xử lý từng item; item email đã tồn tại trong assessment → skip (không throw, trả warning).

**FR-5.4**: Response: `{ invited: number, skipped: number, errors: [{ row, reason }] }`.

**FR-5.5**: Hỗ trợ tối thiểu 200 dòng/lần import (không yêu cầu streaming).

---

### FR-6 — Export CSV kết quả (mở rộng)

**FR-6.1**: `GET /organizations/:orgId/assessments/:aid/results/export` trả CSV với các cột:

```
Name, Email, Score (%), Pass/Fail, Percentile, Domain Scores (JSON), Stage, Rating, Recruiter Note, Submitted At, Time Spent (s), Tab Switches, Integrity Score
```

**FR-6.2**: Cột `Recruiter Note` escape dấu phẩy/xuống dòng (wrap bằng double-quote).

---

### FR-7 — Frontend: bảng ứng viên nâng cấp

**FR-7.1**: `CandidateRanking` component (trong `AssessmentResults.tsx`): bảng với cột Rank, Name, Email, Score, Percentile, Stage (badge màu), Integrity Score, Actions.

**FR-7.2**: Click row → mở `CandidateDetailDrawer`:
- Thông tin cơ bản: email, tên, điểm, percentile, thời gian làm, submit at.
- Domain breakdown (từ `domainScores`).
- Stage selector (dropdown badge).
- StarRating 1–5 (click để chọn, gọi `PATCH`).
- Recruiter note textarea (auto-save on blur hoặc nút Save).
- Integrity timeline: danh sách `CandidateEvent` theo thời gian (từ `GET .../events`).

**FR-7.3**: `StageSummary` bar trên đầu trang: đếm số ứng viên theo stage (APPLIED/SCREENING/SHORTLISTED/REJECTED/HIRED).

**FR-7.4**: RECRUITER không thấy nút "Xóa assessment", "Edit assessment settings" — chỉ thấy nút "Invite", "Import CSV", "Export CSV".

---

## 4. Yêu cầu phi chức năng

| ID | Yêu cầu |
|---|---|
| NFR-1 (Hiệu năng) | `getResults` với 500 ứng viên (kèm percentile) < 800ms. Percentile tính bằng sort in-memory (không cần window function ở scale hiện tại). |
| NFR-2 (Bảo mật) | RECRUITER không được gọi bất kỳ endpoint nào ngoài assessment/candidate — guard phải reject `403`, không `404`. |
| NFR-3 (CSV parsing) | Parse client-side để không gửi file raw lên server; chỉ gửi JSON array. |
| NFR-4 (Audit) | `updateCandidateDecision` (stage = HIRED/REJECTED/SHORTLISTED) được ghi vào `AuditLog` (thực hiện ở P3, nhưng service phải gọi `auditService.log(...)` — stub OK ở P1). |

---

## 5. Acceptance Criteria

- [ ] RECRUITER đăng nhập → không thấy "Question Bank", "Settings", "Members" trong sidebar.
- [ ] RECRUITER gọi `PATCH /organizations/:orgId` (sửa org) → `403`.
- [ ] Tạo JobRole "Senior Backend Engineer" → gắn vào assessment → `GET /assessments/:aid` trả `jobRole: { title: "Senior Backend Engineer" }`.
- [ ] 3 ứng viên điểm 90/80/70 → percentile tương ứng 100/67/33 (xấp xỉ).
- [ ] Import CSV 50 dòng (5 email trùng) → response `{ invited: 45, skipped: 5, errors: [] }`.
- [ ] Đổi stage sang HIRED → `decidedBy` và `decidedAt` được ghi; phản ánh trong stage summary.
- [ ] Export CSV chứa cột Stage, Rating, Recruiter Note.

---

## 6. Liên kết

- **Kế hoạch tổng**: [enterprise-entrance-exam-plan.md](../enterprise-entrance-exam-plan.md)
- **Schema**: [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma)
- **Service**: [backend/src/assessments/assessments.service.ts](../../backend/src/assessments/assessments.service.ts)
- **Unit tests P1**: [backend/src/assessments/assessments-p1.service.spec.ts](../../backend/src/assessments/assessments-p1.service.spec.ts)
- **Frontend results**: [src/pages/org/AssessmentResults.tsx](../../src/pages/org/AssessmentResults.tsx)
- **Frontend ranking**: [src/components/org/CandidateRanking.tsx](../../src/components/org/CandidateRanking.tsx)
- **Frontend CSV import**: [src/components/org/CsvImportModal.tsx](../../src/components/org/CsvImportModal.tsx)
