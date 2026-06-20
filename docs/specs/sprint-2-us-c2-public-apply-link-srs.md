# SRS — US-C2: Trang ứng tuyển công khai (Public Apply Link)

|                      |                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| **Tài liệu**         | Software Requirements Specification (SRS)                                                        |
| **Tính năng**        | US-C2 — Public Apply Link                                                                        |
| **Issue**            | [#103](https://github.com/thanhpt-25/brain-gym/issues/103)                                       |
| **Epic**             | C — Thu hút & nhập ứng viên                                                                      |
| **Phiên bản**        | Draft 1.0                                                                                        |
| **Ngày**             | 2026-06-20                                                                                       |
| **Trạng thái**       | Draft — chờ implement                                                                            |
| **Phụ thuộc**        | Sprint 1 hoàn thành; `Assessment`, `CandidateInvite`, `JobRole` đã có; `OrgJoinLink` làm pattern |
| **Module liên quan** | `assessments` hoặc module mới `apply` (backend) · route công khai `/apply/:code` (frontend)      |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-C2**, cho phép Recruiter tạo một link công khai cho một vị trí tuyển dụng để ứng viên bên ngoài tự đăng ký và nhận bài test, mở rộng nguồn ứng viên ngoài danh sách email có sẵn.

### 1.2. Phạm vi

**Trong phạm vi:**

- Model `PublicApplyLink` (code ngẫu nhiên, gắn với `Assessment` + `JobRole`).
- Route công khai `GET /apply/:code` — không yêu cầu xác thực.
- Route nộp đơn `POST /apply/:code` — tạo `CandidateInvite` và gửi email link bài test.
- Rate limiting 5 lần / IP / 15 phút và honeypot field chống bot.
- Lưu `consentedAt` khi ứng viên tích ô đồng ý.
- Admin tạo/toggle/expire link từ trang JobRole detail.

**Ngoài phạm vi:**

- OAuth / đăng nhập mạng xã hội cho ứng viên.
- Upload CV tại bước apply.
- A/B test nhiều landing page cho cùng vị trí.
- Tracking pixel / analytics UTM (để backlog).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ           | Ý nghĩa                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| **PublicApplyLink** | Bản ghi chứa `code` URL-safe, gắn với 1 Assessment và 1 JobRole, có trạng thái active/expired |
| **code**            | Chuỗi ngẫu nhiên 12 ký tự (nanoid), unique, dùng trong URL `/apply/:code`                     |
| **honeypot**        | Field ẩn trong form (`website`); nếu được điền → bot, bỏ qua request                          |
| **consentedAt**     | Timestamp ứng viên tích "Tôi đồng ý" — lưu trên `CandidateInvite`                             |

### 1.4. Hiện trạng trước US-C2

- `OrgJoinLink` (`prisma/schema.prisma` L923) là pattern tham chiếu: có `code`, `maxUses`, `currentUses`, `expiresAt`, `isActive`.
- `CandidateInvite` đã có `candidateEmail`, `candidateName`, `token`, `assessmentId`.
- `inviteCandidates` trong `assessments.service.ts` tạo invite và gửi email.
- `@nestjs/throttler` đã cấu hình trong project.
- Chưa có `PublicApplyLink` model. Chưa có route công khai (tất cả routes hiện tại đều yêu cầu JWT).

---

## 2. Yêu cầu chức năng

### FR-1 — Schema mới: `PublicApplyLink`

```prisma
model PublicApplyLink {
  id           String    @id @default(uuid())
  orgId        String    @map("org_id")
  jobRoleId    String    @map("job_role_id")
  assessmentId String    @map("assessment_id")
  code         String    @unique                    // nanoid(12)
  isActive     Boolean   @default(true) @map("is_active")
  maxUses      Int?      @map("max_uses")
  currentUses  Int       @default(0) @map("current_uses")
  expiresAt    DateTime? @map("expires_at")
  createdBy    String    @map("created_by")
  createdAt    DateTime  @default(now()) @map("created_at")

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  jobRole      JobRole      @relation(fields: [jobRoleId], references: [id])
  assessment   Assessment   @relation(fields: [assessmentId], references: [id])
  creator      User         @relation(fields: [createdBy], references: [id])

  @@index([orgId])
  @@map("public_apply_links")
}
```

Mở rộng `CandidateInvite`:

```prisma
consentedAt      DateTime?  @map("consented_at")
applyLinkId      String?    @map("apply_link_id")   // nguồn gốc invite
```

---

### FR-2 — Admin: tạo / quản lý link

#### `POST /organizations/:orgId/job-roles/:jobRoleId/apply-link`

**RBAC:** OWNER, ADMIN, MANAGER, RECRUITER.

Request body:

```json
{
  "assessmentId": "uuid",
  "maxUses": 500,
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

**Xử lý:**

1. Validate `assessmentId` thuộc `orgId` và `status = ACTIVE`.
2. Validate `jobRoleId` thuộc `orgId`.
3. Sinh `code = nanoid(12)`.
4. Tạo `PublicApplyLink`.

Response `201`:

```json
{
  "id": "uuid",
  "code": "aB3xY7mNqR2k",
  "url": "https://app.certgym.io/apply/aB3xY7mNqR2k",
  "isActive": true,
  "maxUses": 500,
  "currentUses": 0,
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

**Lỗi:**

- `404` nếu jobRole hoặc assessment không tồn tại trong org.
- `400` nếu assessment `status != ACTIVE`.

---

#### `GET /organizations/:orgId/job-roles/:jobRoleId/apply-link`

Response `200`: link hiện tại (hoặc `null` nếu chưa có) kèm `currentUses`, `isActive`.

---

#### `PATCH /organizations/:orgId/job-roles/:jobRoleId/apply-link/:id`

Body fields optional: `isActive`, `maxUses`, `expiresAt`.

Dùng để toggle active/expire link.

---

### FR-3 — Public: xem thông tin vị trí

#### `GET /apply/:code`

**Không cần xác thực.** Guard riêng `PublicApplyGuard` (bypass JWT global guard).

**Xử lý:**

1. Tìm `PublicApplyLink` theo `code`.
2. Kiểm tra: `isActive = true`, chưa hết hạn, `currentUses < maxUses` (nếu có).
3. Load `JobRole { title, department, description }` và `Assessment { title, questionCount, timeLimit }`.

Response `200`:

```json
{
  "jobRole": {
    "title": "Cloud Engineer",
    "department": "Infrastructure",
    "description": "..."
  },
  "assessment": {
    "title": "AWS Cloud Engineer Test",
    "questionCount": 40,
    "timeLimit": 60
  },
  "orgName": "Acme Corp"
}
```

**Lỗi:**

- `404` nếu code không tồn tại.
- `410 Gone` nếu link `isActive = false` hoặc hết hạn.
- `429` nếu `currentUses >= maxUses`.

---

### FR-4 — Public: nộp đơn ứng tuyển

#### `POST /apply/:code`

**Không cần xác thực.** Rate limit: 5 lần / IP / 15 phút.

Request body:

```json
{
  "name": "Nguyen Van A",
  "email": "nguyenvana@example.com",
  "phone": "+84901234567",
  "consent": true,
  "website": ""
}
```

> `website` là honeypot — FE ẩn bằng CSS; backend reject nếu không rỗng.

**Xử lý:**

```
1. Validate link hợp lệ (như FR-3 step 1–2).
2. Kiểm tra honeypot: nếu website != "" → return 200 giả (không tạo invite, không báo lỗi).
3. Validate email RFC5322.
4. Validate consent = true (bắt buộc).
5. Check duplicate: CandidateInvite WHERE assessmentId=link.assessmentId AND candidateEmail=email AND status != EXPIRED → nếu tồn tại → return 200 giả (không tạo trùng, không báo lỗi để tránh email enumeration).
6. Tạo CandidateInvite { assessmentId, candidateEmail, candidateName, token, consentedAt=now, applyLinkId, expiresAt=now+linkExpiryHours }.
7. Gửi email invite (reuse inviteCandidates mail logic).
8. Tăng PublicApplyLink.currentUses += 1 (atomic increment).
```

Response `200` (luôn trả 200 để tránh enumeration):

```json
{
  "message": "Cảm ơn! Vui lòng kiểm tra email để nhận link bài test."
}
```

**Lỗi thực sự (trả về):**

- `400` nếu `consent != true`.
- `400` nếu email không hợp lệ.
- `410` nếu link không còn active.
- `429` rate limit.

---

### FR-5 — Rate limiting & bảo mật

- `@Throttle({ default: { limit: 5, ttl: 900 } })` trên `POST /apply/:code`.
- IP được lấy từ `X-Forwarded-For` (app chạy sau reverse proxy).
- Honeypot field `website`: FE render `<input name="website" style="display:none" tabindex="-1" autocomplete="off">`.
- `currentUses` tăng atomic bằng Prisma `increment`:

```typescript
await prisma.publicApplyLink.update({
  where: { id: link.id },
  data: { currentUses: { increment: 1 } },
});
```

---

## 3. Yêu cầu phi chức năng

| NFR              | Mô tả                                                                          |
| ---------------- | ------------------------------------------------------------------------------ |
| **No auth**      | Routes `/apply/*` bypass JWT guard toàn cục                                    |
| **Rate limit**   | 5 POST / IP / 15 phút; trả 429 với `Retry-After` header                        |
| **Enumeration**  | Honeypot và duplicate đều trả 200 — không tiết lộ thông tin nội bộ             |
| **HTTPS**        | Link chỉ hoạt động trên HTTPS (enforce bằng redirect hoặc HSTS header)         |
| **Expiry check** | Check `expiresAt` và `maxUses` mỗi lần request — không cache                   |
| **Email**        | Gửi trong transaction hoặc sau khi commit — tránh orphan invite không có email |

---

## 4. API Contract tổng hợp

| Method | Path                                                  | Auth     | RBAC                          | Mô tả              |
| ------ | ----------------------------------------------------- | -------- | ----------------------------- | ------------------ |
| POST   | `/organizations/:orgId/job-roles/:jid/apply-link`     | JWT      | OWNER,ADMIN,MANAGER,RECRUITER | Tạo link           |
| GET    | `/organizations/:orgId/job-roles/:jid/apply-link`     | JWT      | Tất cả                        | Xem link hiện tại  |
| PATCH  | `/organizations/:orgId/job-roles/:jid/apply-link/:id` | JWT      | OWNER,ADMIN,MANAGER,RECRUITER | Toggle/expire link |
| GET    | `/apply/:code`                                        | **None** | —                             | Xem info vị trí    |
| POST   | `/apply/:code`                                        | **None** | —                             | Nộp đơn ứng tuyển  |

---

## 5. Giao diện người dùng

### 5.1. JobRole Detail — tab "Apply Link"

- Hiển thị link hiện tại (URL + QR code nhỏ), `currentUses / maxUses`, ngày hết hạn.
- Nút "Tạo link" (nếu chưa có) → modal chọn Assessment, maxUses, expiresAt.
- Nút "Copy link" → copy vào clipboard, toast "Đã sao chép".
- Nút "Vô hiệu hóa" / "Kích hoạt lại" — toggle `isActive`.

### 5.2. Public Landing Page (`/apply/:code`)

- Header: logo org (nếu có) + tên vị trí.
- Mô tả vị trí và thông tin bài test (số câu, thời gian).
- Form: Họ tên (_), Email (_), Số điện thoại (optional), Đồng ý điều khoản (\*).
- Honeypot field ẩn.
- Nút "Ứng tuyển ngay".
- Responsive, không cần sidebar/nav.

### 5.3. Success Screen

Thay form bằng message:

```
✓ Cảm ơn bạn đã ứng tuyển!
Chúng tôi đã gửi link bài test tới {email}.
Vui lòng kiểm tra hộp thư (kể cả mục Spam).
```

### 5.4. Error States

- Link không hợp lệ/hết hạn: trang 410 với message "Link ứng tuyển không còn hiệu lực."
- Link đã đủ lượt: trang 429 với message "Vị trí này đã đủ ứng viên."

---

## 6. Test Cases

| #   | Tình huống                                       | Kết quả mong đợi                                   |
| --- | ------------------------------------------------ | -------------------------------------------------- |
| T1  | GET /apply/:code hợp lệ                          | 200, trả jobRole + assessment info                 |
| T2  | GET /apply/:code với code không tồn tại          | 404                                                |
| T3  | GET /apply/:code với link isActive=false         | 410 Gone                                           |
| T4  | GET /apply/:code với maxUses đã đầy              | 429                                                |
| T5  | POST apply hợp lệ, email mới                     | 200, CandidateInvite tạo, email gửi, currentUses++ |
| T6  | POST apply với honeypot website != ""            | 200 giả, không tạo invite                          |
| T7  | POST apply email đã có invite active             | 200 giả, không tạo invite trùng                    |
| T8  | POST apply consent=false                         | 400 Bad Request                                    |
| T9  | POST apply 6 lần liên tiếp cùng IP               | Lần 6: 429 Too Many Requests                       |
| T10 | POST apply với link hết hạn (expiresAt < now)    | 410 Gone                                           |
| T11 | Admin tạo link với assessmentId không ACTIVE     | 400 Bad Request                                    |
| T12 | Admin toggle isActive=false → candidate GET link | 410 Gone                                           |

---

## 7. Thứ tự implement

1. **Migration** — thêm `PublicApplyLink`, các field mở rộng trên `CandidateInvite`.
2. **PublicApplyModule** — module mới `apply` với controller riêng, bypass JWT guard.
3. **PublicApplyService** — validate link, create invite, increment uses.
4. **Admin endpoints** — thêm vào `JobRoleController` hoặc `AssessmentsController`.
5. **Throttler config** — đảm bảo `ThrottlerModule` cover route `/apply/*`.
6. **FE public page** — route `/apply/:code` không cần auth layout.
7. **FE admin tab** — "Apply Link" trên JobRole detail.
8. **Tests** — unit (honeypot, duplicate, rate), integration (full apply flow), E2E.

---

## 8. Open Questions

- URL base cho public link là `app.certgym.io/apply/:code` hay domain riêng? (Đề xuất: cùng domain, config qua `VITE_API_BASE_URL`.)
- Có cần QR code không? (Đề xuất: generate client-side bằng `qrcode` npm, không cần backend.)
- Gửi email invite có cần queue async không? (Đề xuất: đồng bộ cho MVP, chuyển queue nếu volume lớn.)
- `phone` có bắt buộc không? (Đề xuất: optional, lưu vào field mới `candidatePhone` trên `CandidateInvite` — cần confirm schema.)
