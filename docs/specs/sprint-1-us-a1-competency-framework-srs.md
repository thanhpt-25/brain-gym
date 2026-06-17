# SRS — US-A1: Competency Framework (Định nghĩa năng lực & thang bậc)

|                      |                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------- |
| **Tài liệu**         | Software Requirements Specification (SRS)                                               |
| **Tính năng**        | US-A1 — Competency Framework                                                            |
| **Issue**            | [#95](https://github.com/thanhpt-25/brain-gym/issues/95)                                |
| **Epic**             | A — Khung năng lực & chuẩn theo vị trí                                                  |
| **Phiên bản**        | Draft 1.0                                                                               |
| **Ngày**             | 2026-06-17                                                                              |
| **Trạng thái**       | Draft — chờ implement                                                                   |
| **Phụ thuộc**        | Sprint 0 (schema, competency scaffold)                                                  |
| **Module liên quan** | `competency` (backend) · `OrgCompetencies.tsx`, `src/services/competency.ts` (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-A1**, cho phép Admin/Manager tạo và quản lý _năng lực_ (Competency) trong phạm vi tổ chức: định nghĩa tên, mô tả, thang bậc (vd. 1–5 / Beginner→Expert), gắn câu hỏi và domain vào từng competency, làm nền tảng cho US-A2 (chuẩn JobRole) và US-A3 (hồ sơ gap).

### 1.2. Phạm vi

**Trong phạm vi:**

- CRUD `Competency` trong phạm vi org (tên, mô tả, thang bậc cấu hình được `scaleMin`–`scaleMax`).
- Toggle `isActive` để ẩn/hiện competency mà không xóa.
- Gắn `OrgQuestion` vào competency qua bảng nối `QuestionCompetency` (với weight).
- Quản lý `CompetencyDomain` — domain nào được map với competency này (dùng cho scoring US-A3).
- RBAC: OWNER/ADMIN/MANAGER ghi; MEMBER/RECRUITER chỉ đọc.
- Fix bug path prefix controller.

**Ngoài phạm vi:**

- Tính toán năng lực từ kết quả thi (thuộc US-A3).
- Gắn competency vào JobRole required level (thuộc US-A2).
- Import competency hàng loạt từ CSV.
- Competency dùng chung giữa nhiều org (multi-tenant share).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ               | Ý nghĩa                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| **Competency**          | Năng lực định nghĩa trong org: tên + thang bậc + danh sách domain          |
| **scaleMin / scaleMax** | Giới hạn thang bậc (vd. 1–5 hoặc 1–3); mặc định 1–5                        |
| **CompetencyDomain**    | Domain câu hỏi (category) được map với competency này để tính level        |
| **QuestionCompetency**  | Bảng nối: một câu hỏi OrgQuestion thuộc competency nào, trọng số bao nhiêu |
| **isActive**            | Cờ ẩn/hiện competency; INACTIVE không xuất hiện trong picker US-A2/A3      |

### 1.4. Hiện trạng trước US-A1

- Schema `Competency`, `CompetencyDomain`, `QuestionCompetency` đã tồn tại (Sprint 0).
- CRUD service cơ bản đã có (`competency.service.ts`).
- **BUG CHẶN**: Controller dùng prefix `orgs/:orgId/competencies` trong khi FE service và toàn bộ controller khác dùng `organizations/:orgId/...` → 404 toàn bộ Competency API.
- `MANAGER` chưa được cấp quyền ghi trong `@OrgRoles`.
- Chưa có endpoint gắn/gỡ QuestionCompetency, quản lý CompetencyDomain, toggle isActive.

---

## 2. Yêu cầu chức năng

### FR-1 — Fix bug path prefix (ƯU TIÊN CAO NHẤT)

**Mô tả:** Đổi decorator `@Controller('orgs/:orgId/competencies')` thành `@Controller('organizations/:orgId/competencies')` trong `backend/src/competency/competency.controller.ts`.

**Không có API mới** — chỉ là fix 1 dòng, nhưng chặn toàn bộ tính năng competency.

**Kiểm tra:** `GET /api/v1/organizations/:orgId/competencies` trả 200 thay vì 404.

---

### FR-2 — Thêm MANAGER vào quyền ghi

**Mô tả:** Bổ sung `OrgRole.MANAGER` vào decorator `@OrgRoles(...)` cho các route POST, PATCH, DELETE.

```
POST   /organizations/:orgId/competencies         → OWNER, ADMIN, MANAGER
PATCH  /organizations/:orgId/competencies/:id     → OWNER, ADMIN, MANAGER
DELETE /organizations/:orgId/competencies/:id     → OWNER, ADMIN, MANAGER
GET    /organizations/:orgId/competencies         → tất cả role
GET    /organizations/:orgId/competencies/:id     → tất cả role
```

---

### FR-3 — CRUD Competency

**API đã có, chỉ cần confirm spec và validation:**

#### `POST /organizations/:orgId/competencies`

Request body:

```json
{
  "name": "AWS Networking",
  "description": "Kiến thức mạng AWS VPC, Route53, CloudFront",
  "scaleMin": 1,
  "scaleMax": 5
}
```

Response `201`:

```json
{
  "id": "uuid",
  "orgId": "uuid",
  "name": "AWS Networking",
  "description": "...",
  "scaleMin": 1,
  "scaleMax": 5,
  "isActive": true,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Validation:**

- `name`: required, string, 1–200 ký tự; unique trong org (unique constraint DB)
- `scaleMin`: integer ≥ 1, default 1
- `scaleMax`: integer ≤ 10, default 5
- `scaleMin < scaleMax` (validate ở service layer)

**Lỗi:**

- `409 Conflict` nếu tên đã tồn tại trong org
- `400 Bad Request` nếu scaleMin ≥ scaleMax

#### `GET /organizations/:orgId/competencies`

Query params: `isActive?: boolean`

Response `200`: mảng Competency, sort `name ASC`.

#### `GET /organizations/:orgId/competencies/:id`

Response `200`: Competency kèm `domains[]`.

#### `PATCH /organizations/:orgId/competencies/:id`

Body: subset của CreateCompetencyDto (tất cả optional). Không cho đổi `scaleMin/scaleMax` nếu đã có `JobRoleCompetency` tham chiếu (guard ở service).

#### `DELETE /organizations/:orgId/competencies/:id`

Response `204`. Cascade xóa `CompetencyDomain`, `QuestionCompetency`, `JobRoleCompetency`.

---

### FR-4 — Toggle isActive

#### `PATCH /organizations/:orgId/competencies/:id/toggle-active`

Không cần body. Đảo giá trị `isActive`.

Response `200`: Competency đã cập nhật.

**RBAC:** OWNER, ADMIN, MANAGER.

---

### FR-5 — Gắn OrgQuestion vào Competency

#### `POST /organizations/:orgId/competencies/:id/questions`

Request body:

```json
{
  "orgQuestionId": "uuid",
  "weight": 1.0
}
```

Response `201`: bản ghi QuestionCompetency.

**Validation:**

- `orgQuestionId` phải thuộc cùng `orgId`.
- Không cho gắn trùng (unique constraint); trả `409` nếu đã tồn tại.
- `weight`: float > 0, default 1.0.

#### `GET /organizations/:orgId/competencies/:id/questions`

Response `200`: `[{id, orgQuestionId, weight, question: {title, category}}]`.

#### `DELETE /organizations/:orgId/competencies/:id/questions/:questionId`

`questionId` là `orgQuestionId`. Response `204`.

---

### FR-6 — Quản lý CompetencyDomain

Domain là tên category câu hỏi được map với competency này để dùng trong `inferCompetencyLevel()`.

#### `GET /organizations/:orgId/competencies/:id/domains`

Response `200`: `[{id, domainName, source}]`.

#### `POST /organizations/:orgId/competencies/:id/domains`

Request body:

```json
{
  "domainName": "Networking",
  "source": "ORG_QUESTION_CATEGORY"
}
```

Response `201`. Trả `409` nếu (competencyId, source, domainName) đã tồn tại.

#### `DELETE /organizations/:orgId/competencies/:id/domains/:domainId`

Response `204`.

---

## 3. Yêu cầu phi chức năng

| NFR             | Mô tả                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| **Phân quyền**  | 401 nếu không có JWT; 403 nếu không đủ OrgRole                                  |
| **Unique**      | (orgId, name) unique — enforce ở DB và trả 409 rõ ràng                          |
| **Cascade**     | Xóa Competency → tự xóa CompetencyDomain, QuestionCompetency, JobRoleCompetency |
| **Scope org**   | Mọi query phải filter theo orgId; không để lộ data của org khác                 |
| **Performance** | findAll phải có index trên orgId (đã có trong schema)                           |

---

## 4. API Contract tổng hợp

| Method | Path                                                           | RBAC                | Mô tả                 |
| ------ | -------------------------------------------------------------- | ------------------- | --------------------- |
| GET    | `/organizations/:orgId/competencies`                           | Tất cả              | List competencies     |
| POST   | `/organizations/:orgId/competencies`                           | OWNER,ADMIN,MANAGER | Tạo competency        |
| GET    | `/organizations/:orgId/competencies/:id`                       | Tất cả              | Chi tiết + domains    |
| PATCH  | `/organizations/:orgId/competencies/:id`                       | OWNER,ADMIN,MANAGER | Cập nhật              |
| DELETE | `/organizations/:orgId/competencies/:id`                       | OWNER,ADMIN,MANAGER | Xóa                   |
| PATCH  | `/organizations/:orgId/competencies/:id/toggle-active`         | OWNER,ADMIN,MANAGER | Toggle isActive       |
| GET    | `/organizations/:orgId/competencies/:id/questions`             | Tất cả              | List linked questions |
| POST   | `/organizations/:orgId/competencies/:id/questions`             | OWNER,ADMIN,MANAGER | Link question         |
| DELETE | `/organizations/:orgId/competencies/:id/questions/:questionId` | OWNER,ADMIN,MANAGER | Unlink question       |
| GET    | `/organizations/:orgId/competencies/:id/domains`               | Tất cả              | List domains          |
| POST   | `/organizations/:orgId/competencies/:id/domains`               | OWNER,ADMIN,MANAGER | Thêm domain           |
| DELETE | `/organizations/:orgId/competencies/:id/domains/:domainId`     | OWNER,ADMIN,MANAGER | Xóa domain            |

---

## 5. Giao diện người dùng

### 5.1. Trang Org Settings → Competencies

- List competencies dạng card/table: tên, mô tả, thang bậc (scaleMin–scaleMax), badge Active/Inactive, số domain, số question.
- Button "Thêm năng lực" → modal tạo mới.
- Mỗi row: nút Edit, Toggle Active, Delete (có confirm dialog).

### 5.2. Modal Tạo/Sửa Competency

Fields: Tên (\*), Mô tả, Scale Min (1–9), Scale Max (2–10). Validate client-side.

### 5.3. Trang Chi tiết Competency

Tabs:

- **Domains**: list domain names đã map; nút "Thêm domain" (input text + dropdown source).
- **Câu hỏi**: list OrgQuestion đã gắn với weight; nút "Gắn câu hỏi" (search by title).

---

## 6. Test Cases

| #   | Tình huống                                             | Kết quả mong đợi               |
| --- | ------------------------------------------------------ | ------------------------------ |
| T1  | MANAGER tạo competency mới                             | 201, competency tạo thành công |
| T2  | Tạo competency trùng tên trong cùng org                | 409 Conflict                   |
| T3  | Tạo competency với scaleMin ≥ scaleMax                 | 400 Bad Request                |
| T4  | MEMBER thử tạo competency                              | 403 Forbidden                  |
| T5  | GET competency của org khác                            | 403 hoặc 404                   |
| T6  | Toggle isActive → inactive → active                    | isActive đảo chiều đúng        |
| T7  | Gắn orgQuestion thuộc org khác                         | 400 Bad Request                |
| T8  | Gắn orgQuestion trùng vào cùng competency              | 409 Conflict                   |
| T9  | Xóa competency đang có JobRoleCompetency               | Cascade xóa JobRoleCompetency  |
| T10 | Thêm domain với (competencyId,source,domainName) trùng | 409 Conflict                   |
| T11 | FE gọi GET /organizations/:orgId/competencies          | 200 (bug fix đã áp dụng)       |

---

## 7. Thứ tự implement

1. **Fix FR-1** (đổi prefix controller) — 1 dòng, unblock toàn bộ.
2. **FR-2** (thêm MANAGER vào @OrgRoles) — 1 commit nhỏ.
3. **FR-3** (confirm validation + thêm 409/400 handling trong service).
4. **FR-4** toggle-active endpoint + service.
5. **FR-5** QuestionCompetency endpoints + service.
6. **FR-6** CompetencyDomain endpoints + service.
7. **FE** cập nhật `OrgCompetencies.tsx` — thêm tabs Domains & Questions.
8. Tests cho tất cả FR.

---

## 8. Open Questions

- Có cho phép đổi `scaleMin/scaleMax` sau khi đã có `JobRoleCompetency` tham chiếu không? (Đề xuất: chặn nếu có requiredLevel nằm ngoài range mới.)
- `CompetencyDomainSource` enum có những giá trị nào ngoài `ORG_QUESTION_CATEGORY`? (Cần confirm với schema.)
