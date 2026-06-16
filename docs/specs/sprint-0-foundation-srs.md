# SRS — Sprint 0: Foundation (Competency & De-risking)

|                      |                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tài liệu**         | Software Requirements Specification (SRS)                                                                                                         |
| **Tính năng**        | Sprint 0 — Foundation                                                                                                                             |
| **Phiên bản**        | 1.0 (Draft)                                                                                                                                       |
| **Ngày**             | 2026-06-14                                                                                                                                        |
| **Trạng thái**       | Draft                                                                                                                                             |
| **Phụ thuộc**        | P0 (Smart Assessment Builder), P1 (Recruiting Workflow) — đã có; ADR-003 (suy luận competency level) phải được ratify trước khi merge FR-1        |
| **Module liên quan** | `competency` (mới), `assessments`, `organizations`, `mail`, `org-analytics` (backend) · `src/services/competency.ts`, `OrgSidebar.tsx` (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Tài liệu này đặc tả yêu cầu cho **Sprint 0 — Foundation**, sprint nền tảng & de-risking cho sáng kiến **Organization Enterprise** (đánh giá năng lực nhân sự — _employee competency assessment_ — và tuyển chọn đầu vào — _entry-selection hiring_).

Sprint 0 **không** giao một tính năng end-user hoàn chỉnh. Mục tiêu là dựng các _enabler_ (data model, thuật toán cốt lõi, hạ tầng, scaffold module, util dùng chung, quy trình) để các sprint sau xây dựng bảng năng lực (competency matrix), xếp hạng ứng viên theo năng lực, và gating tuyển dụng mà không phải làm lại nền móng. Mỗi yêu cầu chức năng FR ánh xạ 1–1 với một enabler issue (S0-1…S0-6).

### 1.2. Phạm vi

**Trong phạm vi:**

- **FR-1 (S0-1, #123)**: Data model Prisma cho `Competency`, `CompetencyDomain`, `QuestionCompetency`, `JobRoleCompetency` + migration.
- **FR-2 (S0-2, #124)**: Spike thuật toán suy luận competency level (1–5) từ `domainScores` JSON → ADR-003 + pure function `inferCompetencyLevel()` có unit test.
- **FR-3 (S0-3, #125)**: Chuyển OTP store từ in-memory `Map` → Redis; gửi OTP email thật qua `MailService` (hiện đang là stub TODO); validate biến môi trường SMTP lúc khởi động.
- **FR-4 (S0-4, #126)**: Scaffold NestJS module `competency` (controller/service/module/DTO + `OrgRoleGuard`) + frontend `src/services/competency.ts` + route + entry trong `OrgSidebar` (rỗng / feature-flagged, biên dịch được).
- **FR-5 (S0-5, #127)**: Tách util dùng chung `parseCandidateCsv`; contract-check `getResults` trả về đủ field cho bảng xếp hạng ứng viên.
- **FR-6 (S0-6, #128)**: Project hygiene — Definition of Done, branch/PR conventions, board (chỉ quy trình, không code).

**Ngoài phạm vi (để cho các sprint sau):**

- UI competency matrix thật (CRUD competency, gắn question/domain, bảng năng lực ứng viên).
- Tính & hiển thị competency level cho ứng viên/nhân viên thực tế (chỉ _pure function_ trong Sprint 0, chưa wire vào endpoint).
- Gating tuyển dụng theo `requiredLevel` của `JobRoleCompetency`.
- Recompute điểm ở mức câu hỏi (question-level) — Sprint 0 chốt v0 dùng aggregation theo `domainScores` (xem FR-2).
- Migration dữ liệu lịch sử để gán competency cho question/job-role đã tồn tại.

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ              | Ý nghĩa                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Competency**         | Một năng lực được đặt tên trong phạm vi một org (vd "Backend Engineering", "Data Analysis"), thang điểm `scaleMin..scaleMax` (mặc định 1–5) |
| **CompetencyDomain**   | Bản ghi bắc cầu một competency tới một _key_ trong `domainScores` (tên domain/category); một competency có thể gom nhiều domain             |
| **QuestionCompetency** | Gắn một `OrgQuestion` vào một competency với `weight` — dùng cho chấm điểm mức câu hỏi ở các sprint sau (Sprint 0 chỉ tạo schema)           |
| **JobRoleCompetency**  | Mức năng lực yêu cầu (`requiredLevel`) của một competency đối với một `JobRole` — phục vụ gating tuyển dụng sau này                         |
| **Competency level**   | Số nguyên trong `[scaleMin..scaleMax]` suy ra từ `domainScores` qua `inferCompetencyLevel()`                                                |
| **`domainScores`**     | JSON `Record<string, { correct: number; total: number }>`, key là tên domain/category; có trên `CandidateInvite` và `ExamAttempt`           |
| **OTP**                | Mã 6 chữ số xác thực ứng viên trước khi làm bài (TTL 10 phút, lưu sha256-hash)                                                              |
| **Enabler**            | Hạng mục nền tảng/de-risk không phải user story; tạo điều kiện cho story sau                                                                |
| **ADR-003**            | Architecture Decision Record chốt thuật toán suy luận competency level và lựa chọn v0 (domainScores aggregation)                            |

### 1.4. Hiện trạng (trước Sprint 0)

- **Chưa có** khái niệm competency: schema chỉ có `Organization`, `OrgMember`, `OrgQuestion` (`category String?`, `tags String[]`), `JobRole`, `Assessment`, `CandidateInvite` (`domainScores Json`, `integrityScore`, `otpVerifiedAt`), `ExamAttempt`, `Domain`.
- **OTP** lưu trong `Map` in-memory tại `backend/src/assessments/candidate.service.ts:19` — mất khi restart và **không** chia sẻ giữa nhiều pod. Việc gửi email OTP mới là **stub TODO** (`candidate.service.ts:73`): chỉ `console.log` email đã mask, chưa gọi `MailService`.
- **`MailService`** (`backend/src/mail/mail.service.ts`) đã có transporter nodemailer thật và các hàm `sendEmail`/`sendOrgInvite`/`sendAssessmentInvite`/`sendExamAssigned` — nhưng chưa có hàm gửi OTP và chưa validate biến SMTP lúc khởi động.
- **Redis 7** đã có trong stack (đang dùng cho BullMQ tại `backend/src/queues/*`) — sẵn sàng tái sử dụng cho OTP.
- **CSV parsing** ứng viên hiện nằm rải rác phía client (xem P1 `CsvImportModal`), chưa có util thuần dùng chung, khó viết unit test.
- **`getResults`** (`backend/src/assessments/assessments.service.ts:614`) đã trả `funnel` + `candidates[]` nhưng chưa được "đóng băng" bằng contract test cho nhu cầu xếp hạng năng lực sắp tới.
- **Quy trình** Definition of Done / branch / PR / board cho sáng kiến Enterprise chưa được thống nhất chính thức.

---

## 2. Mô tả tổng quan

### 2.1. Bối cảnh sản phẩm

Sáng kiến Enterprise mở rộng CertGym từ "luyện thi chứng chỉ" sang "đánh giá năng lực nhân sự & tuyển chọn đầu vào". Điều này cần một mô hình **competency** ổn định, một **thuật toán suy luận level** đáng tin, và hạ tầng xác thực ứng viên **multi-pod-safe**. Sprint 0 cố tình tách các rủi ro kỹ thuật này ra trước, để các sprint feature về sau chỉ tập trung vào UX/business logic trên một nền đã ratify (ADR-003) và không bị chặn bởi schema migration hay refactor hạ tầng.

Nguyên tắc chủ đạo của Sprint 0: **mọi thứ phải biên dịch & xanh CI, nhưng phần lớn còn ẩn sau feature flag / chưa wire end-to-end.** Không thay đổi hành vi người dùng hiện hữu (trừ FR-3, là cải thiện độ tin cậy OTP — phải tương thích ngược).

### 2.2. Nhóm người dùng & vai trò

| Vai trò                    | Liên quan tới Sprint 0                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Owner / Admin**          | Sẽ là người quản trị competency matrix (UI ở sprint sau). Trong Sprint 0: là role được phép gọi endpoint scaffold của module `competency` (FR-4) |
| **Manager**                | Quản lý competency & gán cho job role/assessment (sau này). Có quyền trên các endpoint competency (FR-4)                                         |
| **Recruiter**              | Người tiêu thụ bảng xếp hạng ứng viên theo năng lực (sau này) — phụ thuộc contract `getResults` ở FR-5                                           |
| **Candidate (ứng viên)**   | Người nhận & nhập OTP khi làm bài — trực tiếp hưởng lợi từ FR-3 (OTP tin cậy hơn, email thật)                                                    |
| **Developer / Maintainer** | Đối tượng chính của FR-2 (pure function + ADR), FR-5 (util dùng chung) và FR-6 (quy trình)                                                       |

---

## 3. Yêu cầu chức năng

### FR-1 — Data model Competency (S0-1, #123)

**Mô tả:** Bổ sung 4 model Prisma nền tảng cho competency vào `backend/prisma/schema.prisma` + một migration. Sprint 0 chỉ tạo schema + quan hệ + index; **không** seed dữ liệu, **không** wire vào business logic.

**Đầu vào / Đầu ra:**

- Đầu vào: schema hiện tại (`Organization` L806, `OrgQuestion` L908, `JobRole` L1031).
- Đầu ra: 4 model mới + migration SQL (`npx prisma migrate dev`); `npx prisma generate` sinh client không lỗi.

**Mô hình dữ liệu chuẩn (provisional, ratify bởi ADR-003):**

```prisma
model Competency {
  id          String   @id @default(uuid())
  orgId       String   @map("org_id")
  name        String
  description String?
  scaleMin    Int      @default(1) @map("scale_min")
  scaleMax    Int      @default(5) @map("scale_max")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  organization Organization          @relation(fields: [orgId], references: [id], onDelete: Cascade)
  domains      CompetencyDomain[]
  questions    QuestionCompetency[]
  jobRoles     JobRoleCompetency[]

  @@unique([orgId, name])
  @@map("competencies")
}

model CompetencyDomain {
  id           String @id @default(uuid())
  competencyId String @map("competency_id")
  domainName   String @map("domain_name") // khớp key trong domainScores (case-insensitive)

  competency Competency @relation(fields: [competencyId], references: [id], onDelete: Cascade)

  @@unique([competencyId, domainName])
  @@map("competency_domains")
}

model QuestionCompetency {
  id            String @id @default(uuid())
  competencyId  String @map("competency_id")
  orgQuestionId String @map("org_question_id")
  weight        Float  @default(1)

  competency  Competency  @relation(fields: [competencyId], references: [id], onDelete: Cascade)
  orgQuestion OrgQuestion @relation(fields: [orgQuestionId], references: [id], onDelete: Cascade)

  @@unique([competencyId, orgQuestionId])
  @@map("question_competencies")
}

model JobRoleCompetency {
  id            String @id @default(uuid())
  jobRoleId     String @map("job_role_id")
  competencyId  String @map("competency_id")
  requiredLevel Int    @map("required_level")

  jobRole    JobRole    @relation(fields: [jobRoleId], references: [id], onDelete: Cascade)
  competency Competency @relation(fields: [competencyId], references: [id], onDelete: Cascade)

  @@unique([jobRoleId, competencyId])
  @@map("job_role_competencies")
}
```

**Quy tắc nghiệp vụ:**

- Competency luôn thuộc về đúng một org (`orgId`); tên duy nhất trong org (`@@unique([orgId, name])`).
- `CompetencyDomain.domainName` bắc cầu sang **key** của `domainScores` và phải so khớp **case-insensitive** khi chấm điểm (chuẩn hóa lúc đọc, không lúc ghi).
- `requiredLevel`, `scaleMin`, `scaleMax` là số nguyên; ràng buộc `scaleMin <= requiredLevel <= scaleMax` được kiểm ở tầng service các sprint sau (không phải DB constraint trong Sprint 0).
- Cascade delete: xóa org/question/job-role kéo theo bản ghi liên quan.

**Ràng buộc:**

- Phải thêm quan hệ ngược trên `Organization`, `OrgQuestion`, `JobRole` để Prisma client hợp lệ.
- TS loose (`noImplicitAny`/`strictNullChecks` = false) — không thay đổi cấu hình này.
- Migration phải reversible về mặt thực tế (không drop dữ liệu hiện hữu).

**Tiêu chí hoàn thành:**

- [ ] `npx prisma migrate dev` chạy sạch trên DB rỗng và DB đã seed.
- [ ] `npx prisma generate` không lỗi; build backend xanh.
- [ ] 4 bảng + 4 unique index xuất hiện trong migration SQL.

---

### FR-2 — Spike: `inferCompetencyLevel()` + ADR-003 (S0-2, #124)

**Mô tả:** Nghiên cứu (spike) và chốt thuật toán suy luận competency level (1–5, tổng quát hóa `scaleMin..scaleMax`) từ `domainScores`. Sản phẩm: (a) **ADR-003** ghi lại quyết định + open question; (b) **pure function** `inferCompetencyLevel()` thuần (không side-effect, không DB) kèm unit test.

**Đầu vào / Đầu ra:**

```ts
interface CompetencyScaleConfig {
  scaleMin: number; // mặc định 1
  scaleMax: number; // mặc định 5
  domainNames: string[]; // các CompetencyDomain.domainName của competency
}

type DomainScores = Record<string, { correct: number; total: number }>;

// Pure function — đầu ra tất định, không phụ thuộc DB / clock
function inferCompetencyLevel(
  domainScores: DomainScores,
  config: CompetencyScaleConfig,
): { level: number; percentage: number; matchedDomains: string[] };
```

- Đầu vào: `domainScores` (từ `CandidateInvite`/`ExamAttempt`), cấu hình thang điểm + danh sách domain của competency.
- Đầu ra: `level` ∈ `[scaleMin..scaleMax]`, `percentage` ∈ `[0..100]`, danh sách domain đã khớp.

**Quy tắc nghiệp vụ (Scoring v0 — chốt bởi ADR-003):**

- `percentage = Σ correct / Σ total` trên các domain của competency được khớp (case-insensitive theo `domainNames`).
- Bucket `percentage` → `level` đều trên dải `[scaleMin..scaleMax]`. Số bucket = `scaleMax - scaleMin + 1`. Ví dụ thang 1–5: `[0,20) → 1`, `[20,40) → 2`, `[40,60) → 3`, `[60,80) → 4`, `[80,100] → 5` (biên/làm tròn phải ghi rõ trong ADR và phản ánh trong test).
- **Open question (ghi trong ADR):** chấm điểm mức câu hỏi (`QuestionCompetency.weight`) vs aggregation theo `domainScores`. **Sprint 0 chọn `domainScores` aggregation cho v0**; question-level để ngỏ cho v1.
- Edge cases bắt buộc xử lý: không domain nào khớp → trả `level = scaleMin`, `percentage = 0`, `matchedDomains = []`; `Σ total = 0` → tránh chia 0, trả `percentage = 0`.

**Ràng buộc:**

- Hàm **thuần**: không đọc DB, không `Date.now()`, không random — để test tất định.
- Khớp domain phải case-insensitive và bỏ qua key trong `domainScores` không thuộc competency.
- Tham chiếu hình dạng `domainScores` thực tế tại `org-analytics.service.ts` (`getSkillGaps` ~L179) và `candidate.service.ts` (`submitAttempt` L197–223) để không lệch schema.

**Tiêu chí hoàn thành:**

- [ ] ADR-003 tồn tại (xem ghi chú đánh số ADR ở §6): nêu vấn đề, các phương án, quyết định v0, open question (question-level recompute), hệ quả.
- [ ] `inferCompetencyLevel()` có unit test phủ: nhiều domain, 1 domain, không khớp domain, `total = 0`, biên bucket, thang điểm tùy biến (vd 1–4).
- [ ] Hàm thuần — test chạy không cần DB/Redis.

---

### FR-3 — OTP qua Redis + email thật + validate SMTP (S0-3, #125)

**Mô tả:** Thay `Map` in-memory bằng Redis cho OTP store (multi-pod-safe, TTL tự hết hạn), hiện thực việc gửi OTP qua `MailService` (thay stub TODO), và validate biến môi trường SMTP lúc khởi động ứng dụng.

**Đầu vào / Đầu ra:**

- `requestOtp(token)`: sinh mã 6 chữ số, hash sha256, `SETEX` vào Redis, gửi email chứa mã; trả `{ message }` (không lộ mã).
- `verifyOtp(token, code)`: `GET` hash từ Redis, so khớp, `DEL` khi đúng, set `CandidateInvite.otpVerifiedAt = now()`.

**Quy tắc nghiệp vụ:**

- **Redis key scheme:** `otp:{inviteId}` → giá trị = sha256-hash của mã. TTL = **600s** (10 phút), set bằng `SETEX` (hết hạn tự động, không cần job dọn dẹp).
- Một mã mới ghi đè key cũ (reset TTL). Verify thành công → `DEL otp:{inviteId}` (one-shot).
- Verify khi key không tồn tại/đã hết hạn → lỗi 400 "No OTP requested / OTP has expired" (giữ nguyên thông điệp hiện tại).
- **Email:** thêm `MailService.sendOtp(email, code)` (HTML giống style các template hiện có) và gọi nó trong `requestOtp` thay cho TODO. Lỗi gửi mail được log (không lộ mã) và **không** chặn flow tạo OTP nếu hạ tầng mail tạm lỗi (giữ nhất quán với pattern `try/catch` của `MailService`) — quyết định "fail open vs fail closed" ghi trong PR; mặc định fail-open như các mail khác.
- **Validate SMTP lúc khởi động:** kiểm tra `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` hiện diện khi `NODE_ENV !== 'test'`; thiếu biến bắt buộc → log cảnh báo rõ ràng (và/hoặc fail-fast theo quyết định ADR/PR). `NODE_ENV === 'test'` giữ transporter no-op như hiện tại.
- Giữ nguyên: TTL 10 phút, mã sinh bằng `crypto.randomInt(100_000, 1_000_000)`, hash sha256.

**Ràng buộc:**

- Tái sử dụng Redis client đang có trong stack (BullMQ/`backend/src/queues/*`); không thêm dependency mới nếu tránh được.
- **Không bao giờ** log mã OTP thô (giữ nguyên log email đã mask tại `candidate.service.ts:70–71`).
- Tương thích ngược: client gọi `requestOtp`/`verifyOtp` không đổi contract HTTP.

**Tiêu chí hoàn thành:**

- [ ] OTP lưu ở Redis key `otp:{inviteId}` với TTL 600s; restart 1 pod không mất OTP đang hiệu lực; 2 pod chia sẻ được OTP.
- [ ] `requestOtp` gửi email thật qua `MailService.sendOtp` (verify bằng Mailtrap/no-op ở test).
- [ ] App fail-fast/cảnh báo khi thiếu biến SMTP bắt buộc (ngoài môi trường test).
- [ ] Không có log nào in mã OTP thô; test xanh.

---

### FR-4 — Scaffold module `competency` (BE + FE) (S0-4, #126)

**Mô tả:** Dựng khung module NestJS `competency` (mirror pattern `backend/src/org-questions/`) + service frontend + route + entry sidebar — tất cả **rỗng/feature-flagged nhưng biên dịch được**. Không có business logic thật trong Sprint 0.

**Đầu vào / Đầu ra:**

- Backend: `competency.module.ts`, `competency.controller.ts`, `competency.service.ts`, `dto/` (vd `create-competency.dto.ts`, `update-competency.dto.ts`) dưới `backend/src/competency/`.
- Frontend: `src/services/competency.ts` (TanStack-Query-ready functions), route trong `App.tsx`, entry trong `OrgSidebar.tsx`.

**Quy tắc nghiệp vụ:**

- **Endpoints scaffold** (org-scoped, guard `OrgRoleGuard` + `@OrgRoles('OWNER','ADMIN','MANAGER')`):

  ```
  GET    /organizations/:orgId/competencies            → list (Sprint 0: trả [] hoặc 501-stub)
  POST   /organizations/:orgId/competencies            → create (stub)
  GET    /organizations/:orgId/competencies/:id        → detail (stub)
  PATCH  /organizations/:orgId/competencies/:id        → update (stub)
  DELETE /organizations/:orgId/competencies/:id        → soft delete (stub)
  ```

- Guard và decorator tái dùng `backend/src/organizations/guards/org-role.guard.ts` + `backend/src/common/decorators/org-roles.decorator.ts` (`OrgRoles(...roles: OrgRole[])`).
- DTO dùng `class-validator`; mọi endpoint org-scoped phải lấy `orgId` từ path và bị guard chặn theo role (tenant isolation — xem NFR).
- **Feature flag:** entry sidebar "Competencies" và route ẩn sau cờ (vd `VITE_FEATURE_COMPETENCY` hoặc cờ org). Tab `OrgSidebar` theo đúng pattern `roles: ['OWNER','ADMIN','MANAGER']` đã dùng cho Tracks/Manage Catalog; **ẩn với RECRUITER/MEMBER**.
- `src/services/competency.ts` gọi qua axios instance dùng chung (`src/services/api.ts`) với base `/api/v1`.

**Ràng buộc:**

- Module phải được import vào `AppModule`; app khởi động không lỗi.
- Không expose endpoint hoạt động thật (stub trả rỗng hoặc 501) để tránh dùng nhầm khi chưa ratify.
- FE phải build (`npm run build`) và lint (`npm run lint`) xanh kể cả khi flag tắt.

**Tiêu chí hoàn thành:**

- [ ] `backend/src/competency/` đủ controller/service/module/DTO; `AppModule` import; backend build + start xanh.
- [ ] Endpoint competency bị `OrgRoleGuard` chặn: gọi với role MEMBER/RECRUITER → `403`.
- [ ] `src/services/competency.ts` + route + sidebar entry tồn tại; FE build/lint xanh; entry ẩn khi flag tắt.

---

### FR-5 — Util `parseCandidateCsv` + contract-check `getResults` (S0-5, #127)

**Mô tả:** Tách logic parse CSV ứng viên thành một util thuần dùng chung, có unit test; đồng thời "đóng băng" hợp đồng (contract) của `getResults` bằng test khẳng định nó trả đủ field cho bảng xếp hạng ứng viên (chuẩn bị cho xếp hạng theo năng lực).

**Đầu vào / Đầu ra:**

```ts
interface ParsedCandidateRow {
  name?: string;
  email: string;
}
interface ParseCandidateCsvResult {
  valid: ParsedCandidateRow[];
  errors: { row: number; reason: string }[];
}
function parseCandidateCsv(raw: string): ParseCandidateCsvResult;
```

- Đầu vào: nội dung CSV thô (header `name,email` tùy chọn, auto-detect).
- Đầu ra: danh sách hợp lệ + danh sách lỗi theo dòng (email không hợp lệ, thiếu email, trùng).

**Quy tắc nghiệp vụ:**

- Util **thuần** (string in → object out), không side-effect, dùng được cả FE (thay logic trong `CsvImportModal`) lẫn BE nếu cần.
- Auto-detect header row; bỏ dòng trống; trim; validate email; đánh dấu duplicate trong cùng file.
- **Contract `getResults`** (`backend/src/assessments/assessments.service.ts:614`): viết contract test khẳng định response chứa `funnel { total, started, submitted, passed }` và mỗi phần tử `candidates[]` có tối thiểu: `percentile`, `domainScores`, `integrityScore`, `stage`, `rating`, `recruiterNote`, `timeSpent`, `tabSwitchCount` (cộng `name`, `email`). Đây là các field bảng xếp hạng năng lực sẽ tiêu thụ; test sẽ **fail** nếu sprint sau vô tình bỏ field.

**Ràng buộc:**

- Không đổi hành vi `getResults`; chỉ thêm test khóa contract.
- Util đặt nơi cả FE/BE truy cập được (vd `src/lib/` cho FE; nếu BE cần thì cân nhắc package dùng chung — quyết định ghi trong PR, mặc định bản FE trước).
- Giữ tương thích với `CsvImportModal` hiện có (tối thiểu 200 dòng/lần, không streaming).

**Tiêu chí hoàn thành:**

- [ ] `parseCandidateCsv` có unit test: có/không header, email lỗi, thiếu email, trùng, dòng trống.
- [ ] `CsvImportModal` dùng util (không còn parse inline trùng lặp).
- [ ] Contract test `getResults` xanh và fail khi xóa thử một field bắt buộc.

---

### FR-6 — Project hygiene (S0-6, #128)

**Mô tả:** Thiết lập quy trình cho sáng kiến Enterprise — **chỉ quy trình, không code**: Definition of Done (DoD), branch/PR conventions, và board sprint.

**Đầu vào / Đầu ra:**

- Đầu ra: tài liệu DoD + tài liệu/wiki conventions + board được cấu hình (cột, label, mapping issue → sprint).

**Quy tắc nghiệp vụ:**

- **Definition of Done:** mỗi PR phải — build + lint + test xanh; coverage ≥ 80% cho code mới (xem NFR); migration (nếu có) chạy được; cập nhật doc/ADR liên quan; review bởi ≥1 người.
- **Branch convention:** `feat/`, `fix/`, `chore/`, `spike/`, `docs/` + tham chiếu issue (vd `feat/s0-4-competency-scaffold`).
- **PR convention:** tiêu đề conventional-commits (`feat(...)`, `fix(...)`, `chore(...)`), mô tả + test plan + liên kết issue #123–#128.
- **Board:** cột (Backlog → In Progress → In Review → Done), label cho enabler vs story, gắn 6 issue Sprint 0 vào board.

**Ràng buộc:**

- Không sửa code sản phẩm; có thể thêm/sửa file docs và (tùy chọn) template PR/issue.

**Tiêu chí hoàn thành:**

- [ ] DoD viết thành văn và được team đồng thuận.
- [ ] Branch/PR conventions tài liệu hóa.
- [ ] Board cấu hình; 6 issue #123–#128 nằm trên board đúng cột/label.

---

## 4. Yêu cầu phi chức năng (NFR)

| ID        | Nhóm                               | Yêu cầu                                                                                                                                                                                                                                                                                                    |
| --------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NFR-1** | Bảo mật — Tenant isolation         | Mọi endpoint của module `competency` (FR-4) phải org-scoped và qua `OrgRoleGuard`; truy cập sai org hoặc sai role → `403` (không `404`, không lộ tồn tại tài nguyên). `Competency.orgId` luôn được áp khi truy vấn ở các sprint sau.                                                                       |
| **NFR-2** | Bảo mật — OTP brute-force          | `verifyOtp` (FR-3) phải chống đoán mò: cân nhắc đếm số lần thử/`otp:{inviteId}` và khóa sau N lần sai (vd 5) hoặc rate-limit theo IP/invite. Mã 6 chữ số + TTL 600s; sai mã trả thông điệp chung (không tạo oracle phân biệt "sai" vs "hết hạn" quá chi tiết).                                             |
| **NFR-3** | Bảo mật — No secrets in logs       | Tuyệt đối không log mã OTP thô; chỉ log email đã mask. Không log biến SMTP (`MAIL_PASS`). Lỗi không được leak hash/secret.                                                                                                                                                                                 |
| **NFR-4** | Hiệu năng                          | `inferCompetencyLevel()` (FR-2) là O(số domain) thuần CPU, < 1ms/lần gọi điển hình. OTP qua Redis: `SETEX`/`GET`/`DEL` < 5ms. `parseCandidateCsv` 200 dòng < 50ms.                                                                                                                                         |
| **NFR-5** | Độ tin cậy (Reliability)           | OTP TTL tự hết hạn qua Redis `SETEX` (không cần cron dọn). Multi-pod: OTP đặt ở pod A verify được ở pod B. Mất kết nối Redis được xử lý có kiểm soát (lỗi rõ ràng, không crash app); restart pod không mất OTP đang hiệu lực.                                                                              |
| **NFR-6** | Khả năng bảo trì (Maintainability) | Module `competency` mirror đúng pattern `org-questions` (controller/service/module/dto). Util/pure function (FR-2, FR-5) thuần, không side-effect, dễ test. File < 800 dòng, hàm < 50 dòng. Migration reversible.                                                                                          |
| **NFR-7** | Khả năng kiểm thử (Testability)    | Coverage ≥ **80%** cho code mới. `inferCompetencyLevel` và `parseCandidateCsv` phủ edge case. OTP-Redis test bằng Redis thật (testcontainer) hoặc mock có kiểm soát. Contract test `getResults` khóa các field bắt buộc. Tất cả test chạy không phụ thuộc môi trường ngoài (no-op mail ở `NODE_ENV=test`). |
| **NFR-8** | Tương thích ngược                  | FR-3 không đổi contract HTTP của `requestOtp`/`verifyOtp`. FR-1/FR-4 không thay đổi hành vi người dùng hiện hữu (schema/endpoint mới, feature-flagged). FR-5 không đổi output `getResults`.                                                                                                                |

---

## 5. Acceptance Criteria

Truy vết tới FR tương ứng.

- [ ] **(FR-1)** `npx prisma migrate dev` + `npx prisma generate` xanh; 4 bảng `competencies`, `competency_domains`, `question_competencies`, `job_role_competencies` + 4 unique index tồn tại; quan hệ ngược trên `Organization`/`OrgQuestion`/`JobRole` hợp lệ.
- [ ] **(FR-2)** ADR-003 tồn tại với quyết định v0 (`domainScores` aggregation) + open question (question-level). `inferCompetencyLevel({}, …)` → `{ level: scaleMin, percentage: 0 }`; `total = 0` không chia 0; bucket biên đúng theo ADR; phủ thang 1–5 và thang tùy biến.
- [ ] **(FR-3)** OTP nằm ở Redis `otp:{inviteId}` TTL 600s; 2 pod chia sẻ OTP; `requestOtp` gửi email qua `MailService.sendOtp`; thiếu biến SMTP → cảnh báo/fail-fast (ngoài test); không log mã thô.
- [ ] **(FR-4)** `backend/src/competency/*` (controller/service/module/dto) + import vào `AppModule`; gọi competency endpoint với role MEMBER/RECRUITER → `403`; `src/services/competency.ts` + route + sidebar entry tồn tại, ẩn khi flag tắt; BE & FE build/lint xanh.
- [ ] **(FR-5)** `parseCandidateCsv` có unit test đầy đủ và được `CsvImportModal` dùng; contract test `getResults` khẳng định `funnel` + các field candidate (`percentile`, `domainScores`, `integrityScore`, `stage`, `rating`, `recruiterNote`, `timeSpent`, `tabSwitchCount`) và fail khi thiếu field.
- [ ] **(FR-6)** DoD + branch/PR conventions tài liệu hóa; board cấu hình với 6 issue #123–#128.
- [ ] **(NFR)** Coverage code mới ≥ 80%; CI xanh; không secret/OTP trong log; module competency org-scoped + guard reject `403`.

---

## 6. Liên kết

> **Lưu ý đánh số ADR:** brief gọi tài liệu là **ADR-003**, nhưng `docs/adr/003-pass-predictor-v0.md` đã tồn tại. Khi tạo ở FR-2, dùng số ADR còn trống tiếp theo (vd `004-competency-level-inference.md`) và giữ alias "ADR-003" trong nội dung nếu team muốn, hoặc thống nhất đổi tên — cần reviewer xác nhận.

- **Issues:** #123 (S0-1, FR-1) · #124 (S0-2, FR-2) · #125 (S0-3, FR-3) · #126 (S0-4, FR-4) · #127 (S0-5, FR-5) · #128 (S0-6, FR-6)
- **ADR (tạo ở FR-2):** [docs/adr/](../adr/) — competency level inference v0 (xem lưu ý đánh số ở trên)
- **Basic design (Enterprise initiative):** [enterprise-entrance-exam-plan.md](../enterprise-entrance-exam-plan.md)
- **SRS liên quan:** [P1 — Recruiting Workflow (ATS-lite)](./p1-recruiting-workflow-srs.md) · [P0 — Smart Assessment Builder](./p0-smart-assessment-builder-srs.md)
- **Schema:** [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma)
- **OTP hiện tại:** [backend/src/assessments/candidate.service.ts](../../backend/src/assessments/candidate.service.ts) (otpStore L19, requestOtp L54, verifyOtp L79)
- **Mail service:** [backend/src/mail/mail.service.ts](../../backend/src/mail/mail.service.ts)
- **Pattern module mẫu:** [backend/src/org-questions/](../../backend/src/org-questions/) · guard [org-role.guard.ts](../../backend/src/organizations/guards/org-role.guard.ts) · decorator [org-roles.decorator.ts](../../backend/src/common/decorators/org-roles.decorator.ts)
- **`getResults`:** [backend/src/assessments/assessments.service.ts](../../backend/src/assessments/assessments.service.ts) (L614)
- **domainScores tham chiếu:** [org-analytics.service.ts](../../backend/src/org-analytics/org-analytics.service.ts) (getSkillGaps ~L179) · [candidate.service.ts](../../backend/src/assessments/candidate.service.ts) (submitAttempt L197–223)
- **Frontend:** [src/services/competency.ts](../../src/services/competency.ts) _(tạo ở FR-4)_ · [src/components/org/OrgSidebar.tsx](../../src/components/org/OrgSidebar.tsx)
