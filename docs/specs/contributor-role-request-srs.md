# SRS — Contributor Role Request (Learner xin quyền Contributor)

| | |
|---|---|
| **Tài liệu** | Software Requirements Specification (SRS) |
| **Tính năng** | Learner gửi yêu cầu nâng quyền lên CONTRIBUTOR; Admin duyệt/từ chối |
| **Phiên bản** | 0.1 (Draft) |
| **Ngày** | 2026-09-24 |
| **Trạng thái** | Draft — chờ review trước khi implement |
| **Phụ thuộc** | Không (dùng lại `UserRole`, `AuditService`, `MailService` đã có) |
| **Module liên quan** | `users`, `admin`, `audit`, `mail` (backend) · `Profile.tsx`, `Navbar.tsx`, `pages/admin/*` (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Hiện tại Learner muốn đóng góp câu hỏi cho cộng đồng không có cách nào tự xin quyền — Admin phải đổi role thủ công trong tab **Users** khi được nhờ qua kênh ngoài. Tài liệu này đặc tả luồng **Contributor Role Request**: Learner gửi yêu cầu kèm lý do trong app; Admin xem, duyệt hoặc từ chối trong Admin Panel. Khi duyệt, role của user được nâng lên `CONTRIBUTOR` và mọi hành động đều được ghi audit log.

### 1.2. Phạm vi

**Trong phạm vi:**
- Model `ContributorRequest` + enum `ContributorRequestStatus`.
- Điều kiện được phép gửi yêu cầu (eligibility) và cooldown sau khi bị từ chối.
- API cho Learner: gửi, xem trạng thái, huỷ yêu cầu.
- API cho Admin: liệt kê, duyệt, từ chối (có lý do).
- Email thông báo kết quả cho người gửi.
- Audit log cho mọi thay đổi trạng thái.
- Frontend: card "Trở thành Contributor" ở Profile, CTA ở Navbar, tab **Contributor Requests** trong Admin Panel.

**Ngoài phạm vi:**
- Xin quyền `REVIEWER` hoặc `ADMIN` (có thể mở rộng sau bằng cách thêm field `requestedRole`, xem §8).
- Tự động duyệt dựa trên reputation.
- Thu hồi quyền Contributor (vẫn làm thủ công qua `PUT /users/:id/role` như hiện tại).
- Thông báo in-app / notification center (repo chưa có hệ thống notification; chỉ dùng email + trạng thái hiển thị trên Profile).
- Org-level roles (`OrgMember.role`) — tính năng này chỉ áp dụng cho `User.role` toàn hệ thống.

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| **Learner** | User có `User.role = LEARNER` (mặc định khi đăng ký) |
| **Contributor** | User có `User.role = CONTRIBUTOR` — được tạo câu hỏi (`POST /questions`) và submit DRAFT → PENDING |
| **Contributor Request** | Một bản ghi yêu cầu nâng quyền do Learner tạo |
| **Cooldown** | Khoảng thời gian Learner không được gửi lại sau khi bị từ chối |
| **Decision** | Hành động Admin: APPROVE hoặc REJECT một request đang PENDING |

### 1.4. Hiện trạng

- `enum UserRole { LEARNER, CONTRIBUTOR, REVIEWER, ADMIN }` — `backend/prisma/schema.prisma`.
- Quyền Contributor đang được kiểm tra tại `questions.controller.ts` (`@Roles(CONTRIBUTOR, REVIEWER, ADMIN)` cho `POST /questions`, `PUT /questions/:id/status`) và `questions.service.ts#updateStatus`.
- Đổi role chỉ có qua `PUT /users/:id/role` (Admin), đã ghi audit `ROLE_CHANGED`; và `POST /admin/users/bulk-role`.
- Frontend: `Navbar.tsx` hiển thị nút thêm câu hỏi khi `role === "CONTRIBUTOR" || "ADMIN"`; Admin đổi role qua dropdown trong `pages/admin/UsersTab.tsx`.
- `JwtStrategy.validate()` load user từ DB mỗi request → `RolesGuard` dùng **role mới nhất trong DB**, nên sau khi approve backend có hiệu lực ngay, không cần chờ token hết hạn. Chỉ có `useAuthStore.user.role` ở frontend là bị cũ cho tới khi refetch.

---

## 2. Mô tả tổng quan

### 2.1. Luồng chính

```
Learner (Profile)            Backend                          Admin (Admin Panel)
      │  POST /contributor-requests   │                                │
      │ ─────────────────────────────►│  tạo request PENDING           │
      │                               │  audit CONTRIBUTOR_REQUEST_CREATED
      │                               │ ◄───── GET /admin/contributor-requests?status=PENDING
      │                               │ ◄───── POST .../:id/approve  (hoặc /reject + reason)
      │                               │  transaction: request → APPROVED,
      │                               │               user.role → CONTRIBUTOR
      │                               │  audit + email cho Learner
      │  GET /contributor-requests/me │                                │
      │ ◄─────────────────────────────│  status APPROVED               │
      │  refetch /users/me → store cập nhật role → UI mở tính năng Contributor
```

### 2.2. Vòng đời trạng thái

```
            ┌──────────► APPROVED   (Admin duyệt)
PENDING ────┼──────────► REJECTED   (Admin từ chối, bắt buộc lý do)
            └──────────► CANCELLED  (Learner tự huỷ, hoặc hệ thống huỷ — xem FR-6)
```

APPROVED / REJECTED / CANCELLED là trạng thái cuối, không chuyển tiếp được nữa.

### 2.3. Nhóm người dùng

| Actor | Quyền trong tính năng |
|---|---|
| LEARNER | Gửi / xem / huỷ request của chính mình |
| CONTRIBUTOR, REVIEWER | Không thấy CTA; API tạo request trả 409 |
| ADMIN | Liệt kê, xem chi tiết, duyệt, từ chối mọi request |

---

## 3. Yêu cầu chức năng

### FR-1 — Data model

```prisma
enum ContributorRequestStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

model ContributorRequest {
  id              String                   @id @default(uuid())
  userId          String                   @map("user_id")
  status          ContributorRequestStatus @default(PENDING)
  motivation      String                   // lý do muốn đóng góp (bắt buộc)
  expertise       String[]                 @default([]) // certificationId hoặc domain user tự nhận thạo
  sampleUrl       String?                  @map("sample_url") // link portfolio / LinkedIn / credential (tuỳ chọn)
  reviewedById    String?                  @map("reviewed_by_id")
  reviewedAt      DateTime?                @map("reviewed_at")
  decisionReason  String?                  @map("decision_reason") // bắt buộc khi REJECTED
  createdAt       DateTime                 @default(now()) @map("created_at")
  updatedAt       DateTime                 @updatedAt @map("updated_at")

  user       User  @relation("ContributorRequestUser", fields: [userId], references: [id], onDelete: Cascade)
  reviewedBy User? @relation("ContributorRequestReviewer", fields: [reviewedById], references: [id])

  @@index([status, createdAt])
  @@index([userId, createdAt])
  @@map("contributor_requests")
}
```

- Thêm 2 back-relation tương ứng trên `User`.
- **Mỗi user tối đa 1 request PENDING**: enforce bằng partial unique index trong migration SQL (Prisma không khai báo được partial index):
  ```sql
  CREATE UNIQUE INDEX contributor_requests_one_pending_per_user
    ON contributor_requests (user_id) WHERE status = 'PENDING';
  ```
  Service vẫn check trước để trả lỗi thân thiện; index là chốt chặn cho race condition (bắt `P2002` → 409).

### FR-2 — Điều kiện gửi yêu cầu (eligibility)

User chỉ được tạo request khi **tất cả** điều kiện sau đúng:

| # | Điều kiện | Lỗi khi vi phạm |
|---|---|---|
| E1 | `user.role === LEARNER` | 409 `ALREADY_CONTRIBUTOR` |
| E2 | `user.status === ACTIVE` | 403 `ACCOUNT_NOT_ACTIVE` |
| E3 | Không có request PENDING | 409 `REQUEST_ALREADY_PENDING` |
| E4 | Request REJECTED gần nhất có `reviewedAt` cách hiện tại ≥ `CONTRIBUTOR_REQUEST_COOLDOWN_DAYS` (mặc định **30**) | 429 `COOLDOWN_ACTIVE` + `retryAfter` (ISO date) |
| E5 | Tuổi tài khoản ≥ `CONTRIBUTOR_REQUEST_MIN_ACCOUNT_AGE_DAYS` (mặc định **7**) | 403 `NOT_ELIGIBLE` + `reasons[]` |
| E6 | Số `ExamAttempt` đã hoàn thành ≥ `CONTRIBUTOR_REQUEST_MIN_ATTEMPTS` (mặc định **3**) | 403 `NOT_ELIGIBLE` + `reasons[]` |

- Ngưỡng E4–E6 đọc từ env (có default) để Ops chỉnh không cần deploy code. Đặt E5/E6 = 0 để tắt.
- Request CANCELLED **không** tính cooldown.
- Có endpoint `GET /contributor-requests/me/eligibility` trả về kết quả từng điều kiện để frontend hiển thị checklist trước khi user điền form.

### FR-3 — API cho Learner

Tất cả yêu cầu `JwtAuthGuard`. Controller mới `ContributorRequestsController` (`/contributor-requests`) trong module `users` hoặc module riêng `contributor-requests`.

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/contributor-requests/me/eligibility` | `{ eligible: boolean, checks: { key, passed, detail }[], retryAfter?: string }` |
| `POST` | `/contributor-requests` | Tạo request. Body: `CreateContributorRequestDto` |
| `GET` | `/contributor-requests/me` | Request mới nhất của user (hoặc `null`) + lịch sử rút gọn |
| `DELETE` | `/contributor-requests/me` | Huỷ request PENDING → CANCELLED. 404 nếu không có PENDING |

`CreateContributorRequestDto` (class-validator):

| Field | Rule |
|---|---|
| `motivation` | string, bắt buộc, trim, 50–1000 ký tự |
| `expertise` | string[], tuỳ chọn, tối đa 10 phần tử, mỗi phần tử phải là `Certification.id` tồn tại |
| `sampleUrl` | string, tuỳ chọn, `@IsUrl({ protocols: ['https'] })`, ≤ 500 ký tự |

Response của `GET /me` **không** trả `reviewedById`; trả `decisionReason` cho REJECTED để user biết lý do.

Rate limit: `POST /contributor-requests` tối đa 5 lần/giờ/user (dùng throttler nếu đã cấu hình, nếu chưa thì bỏ qua — cooldown + unique pending đã đủ chống spam).

### FR-4 — API cho Admin

Thêm vào `AdminController` (đã có `@Roles(ADMIN)` ở class level).

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/admin/contributor-requests` | Query: `status` (default `PENDING`), `page`, `limit` (≤ 100), `search` (email/displayName). Sort `createdAt ASC` cho PENDING (cũ nhất trước), `DESC` cho các trạng thái khác |
| `GET` | `/admin/contributor-requests/stats` | `{ pending: number }` — dùng cho badge đếm trên tab |
| `GET` | `/admin/contributor-requests/:id` | Chi tiết + snapshot hoạt động của user (xem dưới) |
| `POST` | `/admin/contributor-requests/:id/approve` | Body: `{ note?: string }` (≤ 500) |
| `POST` | `/admin/contributor-requests/:id/reject` | Body: `{ reason: string }` bắt buộc, 10–500 ký tự |

Mỗi item trong list/chi tiết kèm **snapshot hoạt động** để Admin quyết định nhanh:
`user { id, email, displayName, avatarUrl, createdAt, status, points }`, `stats { completedAttempts, avgScore, commentsCount, reportsFiled, previousRequests: { rejected, cancelled } }`, và danh sách tên certification trong `expertise`.

### FR-5 — Logic Approve / Reject

**Approve** — chạy trong `prisma.$transaction`:
1. `updateMany({ where: { id, status: PENDING }, data: { status: APPROVED, reviewedById, reviewedAt: now, decisionReason: note } })`. Nếu `count === 0` → 409 `REQUEST_NOT_PENDING` (đã bị xử lý bởi Admin khác / user đã huỷ).
2. Đọc user; nếu `role !== LEARNER` (VD Admin khác đã nâng thẳng lên REVIEWER) → **không hạ quyền**, giữ nguyên role, vẫn đánh dấu APPROVED, `metadata.roleUnchanged = true`.
3. Nếu `role === LEARNER` → `user.update({ role: CONTRIBUTOR })`.
4. Nếu user `status !== ACTIVE` tại thời điểm duyệt → 409 `USER_NOT_ACTIVE`, rollback (Admin nên Reject hoặc chờ).

Sau khi commit (ngoài transaction, lỗi không làm fail request):
- Audit `CONTRIBUTOR_REQUEST_APPROVED` (targetType `ContributorRequest`) **và** `ROLE_CHANGED` (targetType `User`, metadata `{ oldRole, newRole, source: 'CONTRIBUTOR_REQUEST', requestId }`) — giữ nhất quán với audit hiện có của `PUT /users/:id/role`.
- Gửi email "Bạn đã trở thành Contributor" qua `MailService.sendEmail` kèm link tới trang tạo câu hỏi.

**Reject**:
1. `updateMany({ where: { id, status: PENDING }, data: { status: REJECTED, reviewedById, reviewedAt: now, decisionReason: reason } })`; `count === 0` → 409.
2. Audit `CONTRIBUTOR_REQUEST_REJECTED`, metadata `{ reason }`.
3. Email thông báo kèm lý do và ngày được gửi lại (`reviewedAt + cooldown`).

Admin **không** được duyệt request của chính mình (thực tế Admin không thể có request vì E1, nhưng check `request.userId !== adminId` để phòng dữ liệu cũ).

### FR-6 — Đồng bộ với thay đổi role thủ công

Khi role của user bị đổi qua `PUT /users/:id/role` hoặc `POST /admin/users/bulk-role` trong lúc có request PENDING:
- Nếu role mới ≠ `LEARNER` → tự động chuyển request PENDING của user đó sang `CANCELLED`, `decisionReason = 'Role changed manually by admin'`, audit `CONTRIBUTOR_REQUEST_AUTO_CANCELLED`.
- Thực hiện trong `UsersService.updateRole` (và hàm bulk tương ứng của `AdminService`) để không phát sinh request "mồ côi" trong hàng đợi của Admin.

Khi user bị BAN: request PENDING giữ nguyên (Admin thấy status BANNED trong snapshot và Reject). Không tự động xử lý để tránh mất dấu vết.

### FR-7 — Frontend: phía Learner

**Service** `src/services/contributorRequests.ts`: `getEligibility`, `getMyRequest`, `createRequest`, `cancelRequest` — dùng Axios instance trong `api.ts`.

**Profile (`src/pages/Profile.tsx`)** — thêm card `BecomeContributorCard` (component mới trong `src/components/profile/`), chỉ render khi `user.role === "LEARNER"`:

| Trạng thái | Hiển thị |
|---|---|
| Chưa đủ điều kiện | Checklist E5/E6 (✓/✗ + tiến độ, VD "2/3 bài thi"); nút gửi bị disable |
| Đủ điều kiện, chưa có request | Mô tả quyền lợi Contributor + nút **Gửi yêu cầu** → mở Dialog form |
| PENDING | Badge "Đang chờ duyệt", ngày gửi, nút **Huỷ yêu cầu** (confirm dialog) |
| REJECTED (trong cooldown) | Lý do từ chối + "Bạn có thể gửi lại từ ngày …" |
| REJECTED (hết cooldown) / CANCELLED | Như "đủ điều kiện" + dòng nhỏ về lần trước |
| APPROVED | Không hiện card (role đã là CONTRIBUTOR) |

Form: React Hook Form + Zod, cùng rule với DTO (motivation 50–1000 có bộ đếm ký tự; expertise là multi-select certification lấy từ API certifications hiện có; sampleUrl https). Submit bằng `useMutation`; success → toast + `invalidateQueries(["contributor-request", "me"])`.

**Cập nhật role sau khi được duyệt**: khi `useQuery(["contributor-request","me"])` trả về `APPROVED` mà `useAuthStore.user.role === "LEARNER"` → gọi `GET /users/me` và cập nhật `user` trong auth store (giữ nguyên token). Query này `refetchOnWindowFocus: true`, không polling.

**Navbar (`src/components/Navbar.tsx`)** — với LEARNER, ở vị trí nút "thêm câu hỏi" của Contributor, hiển thị mục menu "Trở thành Contributor" dẫn tới `/profile#contributor`.

**Truy cập route chỉ dành cho Contributor** (VD `QuestionForm`) khi là LEARNER: thay vì trang lỗi chung, hiển thị empty-state có link tới card trên Profile.

### FR-8 — Frontend: Admin Panel

- Thêm tab **Contributor Requests** (`src/pages/admin/ContributorRequestsTab.tsx`) vào `pages/admin/index.tsx`, icon `UserPlus`, kèm badge số PENDING từ `GET /admin/contributor-requests/stats`.
- Bộ lọc status (PENDING mặc định / APPROVED / REJECTED / CANCELLED / ALL) + ô search email/tên + phân trang.
- Bảng: avatar + tên + email, ngày tạo tài khoản, số bài thi, điểm TB, expertise (badge), ngày gửi, trạng thái.
- Click một dòng → Sheet/Drawer chi tiết: motivation đầy đủ, sampleUrl (mở tab mới, `rel="noopener noreferrer"`), snapshot hoạt động, lịch sử request trước đó của user.
- Nút **Approve** (confirm dialog, note tuỳ chọn) và **Reject** (dialog, textarea lý do bắt buộc ≥ 10 ký tự). Sau mutation: invalidate list + stats + `["admin","users"]` để tab Users phản ánh role mới.
- Xử lý 409 `REQUEST_NOT_PENDING`: toast "Yêu cầu đã được xử lý bởi người khác" và refetch.
- Tab **Audit Log** hiện có tự hiển thị các action mới; thêm label hiển thị cho 4 action `CONTRIBUTOR_REQUEST_*` nếu tab có map label.

### FR-9 — Email

Thêm 2 template trong `MailService` (hoặc `email-templates` nếu muốn Admin tuỳ biến):

| Template | Gửi khi | Nội dung chính |
|---|---|---|
| `contributor-request-approved` | Approve | Chúc mừng, quyền mới (tạo câu hỏi, submit review), link hướng dẫn + link tạo câu hỏi, `note` của Admin nếu có |
| `contributor-request-rejected` | Reject | Lý do, ngày có thể gửi lại, gợi ý tăng hoạt động |

Không gửi email cho Admin khi có request mới (tránh spam); Admin theo dõi qua badge trên tab. (Xem câu hỏi mở Q3.)

---

## 4. Yêu cầu phi chức năng

| # | Yêu cầu |
|---|---|
| NFR-1 | **Bảo mật**: mọi endpoint `/admin/contributor-requests*` chỉ ADMIN (class-level guard). Learner chỉ truy cập request của mình — không có endpoint nhận `:id` phía Learner, tránh IDOR |
| NFR-2 | **Toàn vẹn**: approve/reject idempotent-safe nhờ `updateMany where status = PENDING`; partial unique index chặn 2 PENDING song song |
| NFR-3 | **XSS**: `motivation`, `reason` render dạng plain text (không markdown/HTML); `sampleUrl` chỉ chấp nhận `https://` |
| NFR-4 | **Hiệu năng**: list Admin dùng index `(status, createdAt)`; snapshot stats tính bằng `groupBy`/`count` theo lô cho cả trang, không N+1 |
| NFR-5 | **Audit**: 100% thay đổi trạng thái có bản ghi `AuditLog` với actor, target, metadata |
| NFR-6 | **i18n**: chuỗi UI theo cơ chế ngôn ngữ hiện có của frontend |
| NFR-7 | **A11y**: dialog/sheet dùng shadcn (focus trap, `aria-*`), đạt baseline trong `docs/a11y-baseline.md` |

---

## 5. Thay đổi kỹ thuật (tóm tắt)

**Backend**
- `prisma/schema.prisma`: enum + model mới, back-relation trên `User`; migration kèm partial unique index.
- Module mới `src/contributor-requests/` (`controller`, `service`, `dto/`), import `PrismaModule`, `AuditModule`, `MailModule`.
- `src/admin/admin.controller.ts` + `admin.service.ts`: 5 endpoint Admin (hoặc controller riêng `AdminContributorRequestsController` với cùng guard, nếu muốn giữ `AdminController` gọn).
- `src/users/users.service.ts#updateRole` + bulk-role trong `AdminService`: auto-cancel (FR-6).
- `src/mail/mail.service.ts`: 2 hàm gửi email.
- Env mới (có default): `CONTRIBUTOR_REQUEST_COOLDOWN_DAYS=30`, `CONTRIBUTOR_REQUEST_MIN_ACCOUNT_AGE_DAYS=7`, `CONTRIBUTOR_REQUEST_MIN_ATTEMPTS=3`.

**Frontend**
- `src/services/contributorRequests.ts`, `src/services/admin` (thêm hàm admin tương ứng).
- `src/components/profile/BecomeContributorCard.tsx`, cập nhật `src/pages/Profile.tsx`, `src/components/Navbar.tsx`.
- `src/pages/admin/ContributorRequestsTab.tsx`, cập nhật `src/pages/admin/index.tsx`.

**Docs**: cập nhật `docs/02-data_model.md`, `docs/03-api_design.md` sau khi implement.

---

## 6. Acceptance Criteria

| # | Given / When / Then |
|---|---|
| AC-1 | Learner đủ điều kiện gửi form hợp lệ → 201, request PENDING, audit `CONTRIBUTOR_REQUEST_CREATED`, Profile hiện "Đang chờ duyệt" |
| AC-2 | Learner đã có PENDING gửi tiếp (kể cả 2 request đồng thời) → chỉ 1 request được tạo, request còn lại nhận 409 |
| AC-3 | Learner chưa đủ tuổi tài khoản / số bài thi → 403 `NOT_ELIGIBLE` với `reasons[]`; UI hiện checklist, nút disable |
| AC-4 | CONTRIBUTOR/REVIEWER/ADMIN gọi `POST /contributor-requests` → 409 `ALREADY_CONTRIBUTOR`; không thấy CTA |
| AC-5 | Admin Approve → request APPROVED, `user.role = CONTRIBUTOR`, 2 audit log, email gửi đi; ngay request tiếp theo của user tới `POST /questions` được phép (không cần đăng nhập lại) |
| AC-6 | Sau AC-5, Learner mở lại tab/Profile → store cập nhật role, Navbar hiện nút thêm câu hỏi mà không cần logout |
| AC-7 | Admin Reject không có lý do → 400; có lý do → REJECTED, email kèm lý do; user gửi lại trong 30 ngày → 429 kèm `retryAfter` |
| AC-8 | Hai Admin cùng xử lý 1 request → một bên thành công, bên kia 409 `REQUEST_NOT_PENDING`; không có thay đổi role kép |
| AC-9 | Learner huỷ request PENDING → CANCELLED; gửi lại ngay được (không cooldown) |
| AC-10 | Admin đổi role user lên CONTRIBUTOR qua tab Users khi đang PENDING → request tự CANCELLED, biến mất khỏi hàng đợi PENDING |
| AC-11 | Non-admin gọi bất kỳ `/admin/contributor-requests*` → 403 |
| AC-12 | Approve khi user đã là REVIEWER (đổi tay trước đó, trường hợp FR-6 bị bỏ sót) → role giữ REVIEWER, không bị hạ |

---

## 7. Kế hoạch kiểm thử

- **Unit (Jest)** `contributor-requests.service.spec.ts`: từng điều kiện E1–E6; cooldown biên (đúng 30 ngày); approve/reject happy path; approve khi `count === 0`; approve khi role ≠ LEARNER; approve khi user SUSPENDED; auto-cancel trong `updateRole`.
- **E2E (`npm run test:e2e`)**: luồng đầy đủ Learner → Admin approve → Learner tạo câu hỏi thành công; race 2 POST song song (AC-2); race 2 approve (AC-8).
- **Frontend (Vitest)**: `BecomeContributorCard` render đúng 6 trạng thái; form validation Zod; tab Admin xử lý 409.
- **Playwright (`e2e/`)**: smoke — Learner gửi request, Admin duyệt, Learner thấy nút thêm câu hỏi.

---

## 8. Câu hỏi mở

| # | Câu hỏi | Đề xuất mặc định |
|---|---|---|
| Q1 | Ngưỡng eligibility (7 ngày, 3 bài thi) có phù hợp? Có nên thêm điều kiện điểm reputation tối thiểu (ADR-025)? | Giữ 2 điều kiện đơn giản, cấu hình qua env; bổ sung reputation sau khi có dữ liệu |
| Q2 | REVIEWER có được duyệt request không, hay chỉ ADMIN? | Chỉ ADMIN theo yêu cầu hiện tại |
| Q3 | Admin có cần email/digest khi có request mới? | Không; chỉ badge. Cân nhắc digest hàng ngày nếu hàng đợi tồn đọng |
| Q4 | Có SLA xử lý (VD tự nhắc sau 7 ngày PENDING)? | Không trong v1 |
| Q5 | Có mở rộng cho `requestedRole = REVIEWER` sau này? | Thiết kế model để thêm field `requestedRole UserRole @default(CONTRIBUTOR)` không breaking |
| Q6 | Contributor mới có cần giai đoạn thử việc (VD 5 câu đầu bắt buộc qua review)? | Hiện mọi câu của Contributor đã phải qua PENDING → REVIEWER/ADMIN approve, nên không cần thêm |

---

## 9. Liên kết

- `backend/prisma/schema.prisma` — `UserRole`, `User`, `AuditLog`
- `backend/src/users/users.controller.ts` — `PUT /users/:id/role`
- `backend/src/questions/questions.controller.ts`, `questions.service.ts` — quyền Contributor hiện tại
- `backend/src/auth/strategies/jwt.strategy.ts` — role được load từ DB mỗi request
- `src/pages/admin/UsersTab.tsx`, `src/pages/admin/index.tsx`, `src/pages/Profile.tsx`, `src/components/Navbar.tsx`
- `docs/adr/025-reputation-model-tiers.md` — tham khảo cho Q1
