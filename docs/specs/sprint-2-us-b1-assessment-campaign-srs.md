# SRS — US-B1: Đợt đánh giá nội bộ (Assessment Campaign)

|                      |                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------- |
| **Tài liệu**         | Software Requirements Specification (SRS)                                                     |
| **Tính năng**        | US-B1 — Assessment Campaign                                                                   |
| **Issue**            | [#98](https://github.com/thanhpt-25/brain-gym/issues/98)                                      |
| **Epic**             | B — Chu kỳ đánh giá năng lực định kỳ                                                          |
| **Phiên bản**        | Draft 1.0                                                                                     |
| **Ngày**             | 2026-06-20                                                                                    |
| **Trạng thái**       | Draft — chờ implement                                                                         |
| **Phụ thuộc**        | Sprint 1 hoàn thành (Competency, JobRole schema đã có); `OrgExamAssignment` đã có             |
| **Module liên quan** | `campaigns` (backend mới) · `OrgExamAssignment` (backend mở rộng) · Campaign pages (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-B1**, cho phép Admin tạo một _đợt đánh giá nội bộ_ (Assessment Campaign) — nhóm nhiều assignment lại dưới một tên chung, giao cho nhiều phòng ban/thành viên cùng lúc với deadline chung, và theo dõi % hoàn thành theo chiều campaign.

### 1.2. Phạm vi

**Trong phạm vi:**

- CRUD `AssessmentCampaign` trong phạm vi org (tên, mô tả, due date, status).
- Gán nhiều group và/hoặc member vào campaign; mỗi lần gán tạo `OrgExamAssignment` liên kết với `campaignId`.
- Endpoint tổng hợp % hoàn thành theo campaign (total assignments / submitted / pct).
- RBAC: OWNER/ADMIN/MANAGER tạo và quản lý; MEMBER xem tiến độ của mình.

**Ngoài phạm vi:**

- Tự động tạo campaign theo lịch lặp (thuộc US-B2).
- Gửi email nhắc nhở deadline (thuộc US-B2).
- Gắn nhiều catalog vào 1 campaign (MVP: 1 catalogItem per campaign).
- Xóa campaign đang có assignment dở dang (cần soft-delete logic riêng — để Sprint 3).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ              | Ý nghĩa                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------- |
| **AssessmentCampaign** | Đợt đánh giá nội bộ: nhóm các OrgExamAssignment lại dưới một mục tiêu và deadline chung |
| **CampaignStatus**     | DRAFT → ACTIVE → CLOSED (soft lifecycle)                                                |
| **OrgExamAssignment**  | Bản ghi giao exam cho group/member; được mở rộng với `campaignId` nullable              |
| **Progress**           | `{ total, completed, pct }` — tổng hợp theo campaign                                    |

### 1.4. Hiện trạng trước US-B1

- `OrgExamAssignment` (`prisma/schema.prisma` L1046) tồn tại, có `catalogItemId`, `groupId?`, `memberId?`, `dueDate?` — nhưng chưa có `campaignId`.
- Chưa có model `AssessmentCampaign`.
- Chưa có service/controller cho campaigns.
- Chưa có FE trang campaign list / create / detail.

---

## 2. Yêu cầu chức năng

### FR-1 — Schema mới: `AssessmentCampaign`

Thêm vào `prisma/schema.prisma`:

```prisma
enum CampaignStatus {
  DRAFT
  ACTIVE
  CLOSED
}

model AssessmentCampaign {
  id            String         @id @default(uuid())
  orgId         String         @map("org_id")
  name          String
  description   String?
  kind          String         @default("INTERNAL")   // extensible; INTERNAL cho US-B1
  catalogItemId String         @map("catalog_item_id")
  dueDate       DateTime?      @map("due_date")
  status        CampaignStatus @default(DRAFT)
  createdBy     String         @map("created_by")
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  organization Organization       @relation(fields: [orgId], references: [id], onDelete: Cascade)
  catalogItem  ExamCatalogItem    @relation(fields: [catalogItemId], references: [id])
  assignments  OrgExamAssignment[]
  creator      User               @relation(fields: [createdBy], references: [id])

  @@index([orgId])
  @@map("assessment_campaigns")
}
```

Mở rộng `OrgExamAssignment`:

```prisma
campaignId  String?           @map("campaign_id")
campaign    AssessmentCampaign? @relation(fields: [campaignId], references: [id])
```

---

### FR-2 — CRUD Campaign

#### `POST /organizations/:orgId/campaigns`

**RBAC:** OWNER, ADMIN, MANAGER.

Request body:

```json
{
  "name": "Đánh giá năng lực Q3/2026",
  "description": "...",
  "catalogItemId": "uuid",
  "dueDate": "2026-09-30T17:00:00Z"
}
```

Response `201`:

```json
{
  "id": "uuid",
  "orgId": "uuid",
  "name": "Đánh giá năng lực Q3/2026",
  "description": "...",
  "catalogItemId": "uuid",
  "dueDate": "2026-09-30T17:00:00Z",
  "status": "DRAFT",
  "createdBy": "uuid",
  "createdAt": "ISO8601"
}
```

**Validation:**

- `name`: required, 1–200 ký tự, unique trong org.
- `catalogItemId`: phải thuộc cùng orgId.
- `dueDate`: optional, phải là tương lai nếu cung cấp.

**Lỗi:**

- `409 Conflict` nếu tên trùng trong org.
- `404` nếu `catalogItemId` không tồn tại trong org.
- `400` nếu `dueDate` trong quá khứ.

---

#### `GET /organizations/:orgId/campaigns`

Query params: `status?: CampaignStatus`

Response `200`: mảng campaign, sort `createdAt DESC`, mỗi item kèm `{ total, completed, pct }` progress tổng hợp.

---

#### `GET /organizations/:orgId/campaigns/:id`

Response `200`: campaign đầy đủ kèm `assignments[]` (group/member info) và progress.

---

#### `PATCH /organizations/:orgId/campaigns/:id`

Body: subset của CreateCampaignDto + `status?`. Không cho đổi `catalogItemId` khi `status = ACTIVE`.

**Lỗi:**

- `400` nếu đổi status từ CLOSED về DRAFT/ACTIVE.
- `409` nếu tên mới trùng với campaign khác trong org.

---

#### `DELETE /organizations/:orgId/campaigns/:id`

Chỉ cho xóa khi `status = DRAFT`. Response `204`.

**Lỗi:** `409` nếu campaign đang ACTIVE hoặc CLOSED.

---

### FR-3 — Gán group/member vào campaign

#### `POST /organizations/:orgId/campaigns/:id/assign`

**RBAC:** OWNER, ADMIN, MANAGER.

Request body:

```json
{
  "groupIds": ["uuid", "uuid"],
  "memberIds": ["uuid"]
}
```

**Xử lý:**

1. Validate campaign thuộc orgId và không CLOSED.
2. Với mỗi groupId: tạo `OrgExamAssignment { catalogItemId, groupId, dueDate: campaign.dueDate, campaignId }`.
3. Với mỗi memberId: tạo `OrgExamAssignment { catalogItemId, memberId, dueDate: campaign.dueDate, campaignId }`.
4. Bỏ qua (idempotent) nếu (catalogItemId, groupId/memberId, campaignId) đã tồn tại.

Response `201`:

```json
{
  "created": 5,
  "skipped": 1
}
```

---

### FR-4 — Progress campaign

#### `GET /organizations/:orgId/campaigns/:id/progress`

**Tính toán:**

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE submitted_at IS NOT NULL) AS completed
FROM org_exam_assignments a
JOIN candidate_invites ci ON ci.assessment_id = a.catalog_item_id  -- approximate
WHERE a.campaign_id = :id
```

> Lưu ý: `completed` đếm invite có `status = SUBMITTED`. Logic chính xác cần join qua `Assessment` của campaign — xác định ở implementation.

Response `200`:

```json
{
  "total": 40,
  "completed": 28,
  "pct": 70
}
```

---

### FR-5 — Kích hoạt campaign

#### `PATCH /organizations/:orgId/campaigns/:id/activate`

Chuyển status từ DRAFT → ACTIVE. Không cần body.

**Guard:** Phải có ít nhất 1 assignment trước khi activate.

Response `200`: campaign đã cập nhật.

---

## 3. Yêu cầu phi chức năng

| NFR             | Mô tả                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| **RBAC**        | 401 nếu không có JWT; 403 nếu thiếu role                                       |
| **Scope org**   | Mọi query filter theo orgId; không lộ data org khác                            |
| **Idempotency** | Gọi lại assign cùng group/member → skip, không tạo trùng                       |
| **Transaction** | Bulk assignment dùng `prisma.$transaction` hoặc `createMany`                   |
| **Index**       | `campaignId` trên `OrgExamAssignment` cần index (thêm `@@index([campaignId])`) |

---

## 4. API Contract tổng hợp

| Method | Path                                           | RBAC                | Mô tả                         |
| ------ | ---------------------------------------------- | ------------------- | ----------------------------- |
| GET    | `/organizations/:orgId/campaigns`              | Tất cả              | Danh sách campaign + progress |
| POST   | `/organizations/:orgId/campaigns`              | OWNER,ADMIN,MANAGER | Tạo campaign                  |
| GET    | `/organizations/:orgId/campaigns/:id`          | Tất cả              | Chi tiết campaign             |
| PATCH  | `/organizations/:orgId/campaigns/:id`          | OWNER,ADMIN,MANAGER | Cập nhật                      |
| DELETE | `/organizations/:orgId/campaigns/:id`          | OWNER,ADMIN,MANAGER | Xóa (DRAFT only)              |
| PATCH  | `/organizations/:orgId/campaigns/:id/activate` | OWNER,ADMIN,MANAGER | DRAFT → ACTIVE                |
| POST   | `/organizations/:orgId/campaigns/:id/assign`   | OWNER,ADMIN,MANAGER | Gán group/member              |
| GET    | `/organizations/:orgId/campaigns/:id/progress` | Tất cả              | Progress tổng hợp             |

---

## 5. Giao diện người dùng

### 5.1. Trang Campaign List (`/org/:slug/campaigns`)

- Table/card: tên, status badge, due date, progress bar (pct%), số assignment.
- Nút "Tạo đợt đánh giá" → modal tạo mới.
- Filter tab: All / Active / Draft / Closed.

### 5.2. Modal Tạo Campaign

Fields: Tên (_), Mô tả, Chọn catalog exam (_), Due date.

### 5.3. Trang Campaign Detail (`/org/:slug/campaigns/:id`)

- Header: tên, status, due date, progress ring (pct%).
- Tab **Thành viên**: table assignments — group/member name, completion status, submitted date.
- Tab **Cài đặt**: edit name, description, due date; nút Activate / Close.
- Nút "Gán thêm" → modal chọn groups + members.

---

## 6. Test Cases

| #   | Tình huống                                 | Kết quả mong đợi            |
| --- | ------------------------------------------ | --------------------------- |
| T1  | MANAGER tạo campaign hợp lệ                | 201, status=DRAFT           |
| T2  | Tạo campaign trùng tên trong org           | 409 Conflict                |
| T3  | MEMBER thử tạo campaign                    | 403 Forbidden               |
| T4  | Gán group vào campaign 2 lần               | Lần 2: created=0, skipped=1 |
| T5  | Activate campaign không có assignment      | 400 Bad Request             |
| T6  | Xóa campaign đang ACTIVE                   | 409 Conflict                |
| T7  | Progress: 28/40 submitted                  | pct=70                      |
| T8  | Gán memberId không thuộc org               | 400 Bad Request             |
| T9  | PATCH: đổi catalogItemId khi status=ACTIVE | 400 Bad Request             |
| T10 | Đổi status từ CLOSED → ACTIVE              | 400 Bad Request             |

---

## 7. Thứ tự implement

1. **Migration** — thêm `AssessmentCampaign`, enum `CampaignStatus`, FK `campaignId` trên `OrgExamAssignment`.
2. **CampaignService** — CRUD + activate + assign + progress.
3. **CampaignController** — mount dưới `/organizations/:orgId/campaigns`.
4. **Module** — tạo `campaigns.module.ts`, import vào `OrgsModule`.
5. **FE service** — `src/services/campaigns.ts` (TanStack Query hooks).
6. **FE pages** — Campaign list, Create modal, Campaign detail.
7. **Tests** — unit tests CampaignService (progress aggregation, idempotent assign), integration.

---

## 8. Open Questions

- Progress tính theo `CandidateInvite.status=SUBMITTED` hay `OrgExamAssignment` có field riêng? (Đề xuất: join qua catalog → assessment → invite; làm rõ khi implement.)
- Campaign có support nhiều `catalogItemId` không? (MVP: 1; mở rộng US-B2+.)
- Có cần notification khi campaign được activate không? (Để backlog.)
