# SRS — US-A2: Năng lực chuẩn cho JobRole (Required Levels)

| | |
|---|---|
| **Tài liệu** | Software Requirements Specification (SRS) |
| **Tính năng** | US-A2 — JobRole Competency Requirements |
| **Issue** | #96 |
| **Epic** | A — Khung năng lực & chuẩn theo vị trí |
| **Phiên bản** | Draft 1.0 |
| **Ngày** | 2026-06-17 |
| **Trạng thái** | Draft — chờ implement |
| **Phụ thuộc** | US-A1 (#95) phải hoàn thành trước |
| **Module liên quan** | `job-roles` (backend) · `OrgJobRoles.tsx`, `src/services/job-roles.ts` (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-A2**, cho phép Manager định nghĩa mỗi `JobRole` cần những năng lực nào ở bậc tối thiểu (`requiredLevel`). Đây là "chuẩn vị trí" — dữ liệu nền để hệ thống biết "đạt chuẩn" nghĩa là gì, dùng chung cho US-A3 (gap map nội bộ) và US-E2 (ranking ứng viên).

### 1.2. Phạm vi

**Trong phạm vi:**
- Gắn N competency vào một JobRole, mỗi cặp có `requiredLevel`.
- API GET/PUT requirements cho một JobRole.
- UI gán/sửa năng lực chuẩn trong trang quản lý JobRole.
- Validation `requiredLevel` trong `[scaleMin, scaleMax]` của competency tương ứng.
- Competency phải thuộc cùng org với JobRole.

**Ngoài phạm vi:**
- Tính gap năng lực (US-A3).
- Gắn JobRole vào Assessment (Sprint 0 đã có).
- Sao chép template requirements giữa các role.

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| **JobRoleCompetency** | Bảng nối: JobRole → Competency + requiredLevel |
| **requiredLevel** | Bậc năng lực tối thiểu, phải trong [scaleMin, scaleMax] của competency |
| **Requirements** | Tập hợp tất cả JobRoleCompetency của một JobRole |

### 1.4. Hiện trạng trước US-A2

- Schema `JobRole` và `JobRoleCompetency` đã có đầy đủ trong Prisma.
- CRUD JobRole (list/create/update/delete) đã có trong `job-roles.service.ts` và `job-roles.controller.ts`.
- **Không có bất kỳ tham chiếu nào đến `JobRoleCompetency`** trong toàn bộ backend code.
- Không có endpoint GET/PUT requirements, không có UI gán competency cho role.

---

## 2. Yêu cầu chức năng

### FR-1 — Lấy danh sách năng lực chuẩn của JobRole

#### `GET /organizations/:orgId/job-roles/:roleId/competencies`

**RBAC:** Tất cả role (dùng trong UI AssessmentBuilder và US-A3).

Response `200`:
```json
[
  {
    "id": "uuid",
    "competencyId": "uuid",
    "competencyName": "AWS Networking",
    "requiredLevel": 3,
    "scaleMin": 1,
    "scaleMax": 5
  }
]
```

Trả mảng rỗng `[]` nếu chưa có requirements.

---

### FR-2 — Đặt (replace-all) năng lực chuẩn

#### `PUT /organizations/:orgId/job-roles/:roleId/competencies`

**RBAC:** OWNER, ADMIN, MANAGER.

**Semantics:** Replace-all trong transaction — xóa tất cả requirements cũ → insert mới.

Request body:
```json
{
  "requirements": [
    { "competencyId": "uuid-1", "requiredLevel": 3 },
    { "competencyId": "uuid-2", "requiredLevel": 4 }
  ]
}
```

Gửi `"requirements": []` để xóa hết requirements.

Response `200`: mảng như FR-1.

**Validation (thực hiện trước transaction):**
1. `roleId` phải tồn tại và thuộc `orgId`.
2. Mỗi `competencyId` phải tồn tại và thuộc cùng `orgId`.
3. Không có `competencyId` trùng lặp trong payload.
4. `requiredLevel` là integer trong `[competency.scaleMin, competency.scaleMax]`.
5. Bất kỳ item nào fail → toàn bộ request fail `400` (không partial insert).

**Lỗi `400`:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "competencyId": "uuid-1", "error": "requiredLevel 6 out of range [1,5]" }
  ]
}
```

---

### FR-3 — FE: Drawer requirements trong OrgJobRoles

**Luồng:**
1. Click "Năng lực chuẩn" trên một JobRole row → Sheet/Drawer mở.
2. Hiển thị list requirements hiện tại (query FR-1).
3. Thêm: dropdown chọn active competency; input requiredLevel (số, range [scaleMin, scaleMax]).
4. Xóa: button xóa từng row.
5. "Lưu" → PUT FR-2 với toàn bộ state local.
6. Toast thành công / hiển thị lỗi per item.

**FE service** (thêm vào `job-roles.ts`):
```typescript
export const getJobRoleCompetencies = async (
  slug: string,
  roleId: string,
): Promise<JobRoleCompetencyItem[]>

export const setJobRoleCompetencies = async (
  slug: string,
  roleId: string,
  requirements: { competencyId: string; requiredLevel: number }[],
): Promise<JobRoleCompetencyItem[]>
```

---

## 3. Yêu cầu phi chức năng

| NFR | Mô tả |
|---|---|
| **Atomicity** | PUT dùng Prisma `$transaction` (delete-all + createMany) |
| **Scope org** | Mọi competencyId phải thuộc orgId — validate trước transaction |
| **isActive** | Chỉ competency `isActive=true` xuất hiện trong dropdown picker UI |
| **Không breaking** | GET job-roles hiện có không thay đổi response shape |

---

## 4. API Contract

| Method | Path | RBAC | Mô tả |
|---|---|---|---|
| GET | `/organizations/:orgId/job-roles/:roleId/competencies` | Tất cả | Lấy requirements |
| PUT | `/organizations/:orgId/job-roles/:roleId/competencies` | OWNER,ADMIN,MANAGER | Set requirements (replace-all) |

---

## 5. Mô hình dữ liệu

Schema đã có — không cần migration mới:

```prisma
model JobRoleCompetency {
  id            String   @id @default(uuid())
  jobRoleId     String   @map("job_role_id")
  competencyId  String   @map("competency_id")
  requiredLevel Int      @map("required_level")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([jobRoleId, competencyId])
}
```

---

## 6. Test Cases

| # | Tình huống | Kết quả |
|---|---|---|
| T1 | MANAGER set 3 requirements | 200, 3 items trả về |
| T2 | PUT với `requirements: []` | 200, xóa hết |
| T3 | `requiredLevel=6` với `scaleMax=5` | 400 + error detail |
| T4 | `requiredLevel=0` với `scaleMin=1` | 400 |
| T5 | `competencyId` thuộc org khác | 400 |
| T6 | Trùng `competencyId` trong payload | 400 |
| T7 | MEMBER thử PUT | 403 |
| T8 | roleId không tồn tại trong org | 404 |
| T9 | GET role chưa có requirements | 200, `[]` |
| T10 | PUT → GET → kết quả khớp | Consistency |

---

## 7. Thứ tự implement

1. **US-A1 phải done** (competency CRUD hoạt động đúng path).
2. DTO `SetJobRoleCompetenciesDto` (`requirements: [{competencyId, requiredLevel}]`).
3. `getRequirements(orgId, roleId)` + `setRequirements(orgId, roleId, dto)` trong `job-roles.service.ts`.
4. Routes mới trong `job-roles.controller.ts`.
5. FE: thêm 2 functions vào `job-roles.ts`.
6. FE: mở rộng `OrgJobRoles.tsx` với drawer requirements.
7. Unit tests + integration tests.

---

## 8. Open Questions

- Có cần PATCH riêng từng item (chỉ sửa 1 requiredLevel) hay PUT batch là đủ?
- Khi xóa Competency: `onDelete: Restrict` trong schema hiện tại — cần thông báo rõ cho người dùng nếu competency đang được dùng trong JobRole.
