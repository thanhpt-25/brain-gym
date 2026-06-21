# SRS — US-B4: Review của quản lý + Kế hoạch phát triển (IDP)

|                      |                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Tài liệu**         | Software Requirements Specification (SRS)                                                                                        |
| **Tính năng**        | US-B4 — Manager Review & Individual Development Plan (IDP)                                                                       |
| **Issue**            | [#101](https://github.com/thanhpt-25/brain-gym/issues/101)                                                                       |
| **Epic**             | B — Chu kỳ đánh giá năng lực định kỳ                                                                                             |
| **Phiên bản**        | Draft 1.0                                                                                                                        |
| **Ngày**             | 2026-06-21                                                                                                                       |
| **Trạng thái**       | Draft — chờ implement                                                                                                            |
| **Phụ thuộc**        | **US-A3 (#97) closed Sprint 1** ✓ — competency gap profile đã có; **US-B1 (#98) closed Sprint 2** ✓ — `AssessmentCampaign` đã có |
| **Module liên quan** | `campaigns` (backend mở rộng) · `competency` (backend mở rộng) · `src/pages/org/` (frontend)                                     |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-B4**, cho phép Manager thêm nhận xét/định hướng sau mỗi đợt đánh giá theo từng member, gợi ý `LearningTrack` để đóng competency gap, và tạo liên kết IDP hiển thị cho nhân viên — biến điểm số thành kế hoạch hành động cụ thể.

### 1.2. Phạm vi

**Trong phạm vi:**

- Model `CampaignMemberReview` — ghi chú của manager cho từng member trong một campaign cụ thể.
- Model `MemberIdp` — kế hoạch phát triển cá nhân: liên kết member với LearningTrack theo từng competency gap.
- Service + endpoints: tạo/cập nhật review, gợi ý LearningTrack theo gap, xem IDP của member.
- RBAC: OWNER/ADMIN/MANAGER tạo review và IDP; MEMBER đọc IDP của chính mình.

**Ngoài phạm vi:**

- Approval workflow cho IDP (deferred).
- Tích hợp LMS bên ngoài để enroll LearningTrack (deferred).
- Gửi notification khi IDP được cập nhật (thuộc email module Sprint 4).
- Auto-generate gợi ý bằng AI (deferred).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ                | Ý nghĩa                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| **CampaignMemberReview** | Ghi chú của manager cho một member trong một campaign — riêng biệt theo (campaignId, memberId)      |
| **MemberIdp**            | Kế hoạch phát triển cá nhân: gắn LearningTrack vào một competency gap, với target level và deadline |
| **CompetencyGap**        | Hiệu số giữa `JobRoleCompetency.requiredLevel` và score thực tế của member — từ US-A3 gap profile   |
| **LearningTrack**        | Model đã có (schema L1039): nhóm catalog exam theo chủ đề, thuộc org                                |

### 1.4. Hiện trạng trước US-B4

- `AssessmentCampaign` (schema L1067) — đã có.
- `LearningTrack` (schema L1039): `id`, `orgId`, `name`, `description`, `isActive` — đã có, chưa liên kết với member gap.
- `OrgMember` — đã có.
- Competency gap data có sẵn qua `CandidateInvite.domainScores` + `ScorecardService` (US-E3).
- Chưa có model `CampaignMemberReview`.
- Chưa có model `MemberIdp`.
- Chưa có endpoint hoặc UI cho manager review và IDP.

---

## 2. Yêu cầu chức năng

### FR-1 — Schema mới: `CampaignMemberReview`

```prisma
model CampaignMemberReview {
  id          String   @id @default(uuid())
  orgId       String   @map("org_id")
  campaignId  String   @map("campaign_id")
  memberId    String   @map("member_id")
  reviewedBy  String   @map("reviewed_by")        // userId của manager
  note        String   @db.Text                   // nhận xét tự do
  direction   String?  @db.Text                   // định hướng phát triển
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  organization Organization       @relation(fields: [orgId], references: [id], onDelete: Cascade)
  campaign     AssessmentCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  member       OrgMember          @relation(fields: [memberId], references: [id], onDelete: Cascade)
  reviewer     User               @relation(fields: [reviewedBy], references: [id])

  @@unique([campaignId, memberId])               // 1 review per (campaign, member)
  @@index([orgId, memberId])
  @@map("campaign_member_reviews")
}
```

---

### FR-2 — Schema mới: `MemberIdp`

```prisma
model MemberIdp {
  id             String    @id @default(uuid())
  orgId          String    @map("org_id")
  memberId       String    @map("member_id")
  competencyId   String    @map("competency_id")
  trackId        String    @map("track_id")
  targetLevel    Int       @map("target_level")   // level mục tiêu cần đạt
  dueDate        DateTime? @map("due_date")
  completedAt    DateTime? @map("completed_at")
  createdBy      String    @map("created_by")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  organization Organization  @relation(fields: [orgId], references: [id], onDelete: Cascade)
  member       OrgMember     @relation(fields: [memberId], references: [id], onDelete: Cascade)
  competency   Competency    @relation(fields: [competencyId], references: [id], onDelete: Restrict)
  track        LearningTrack @relation(fields: [trackId], references: [id], onDelete: Restrict)
  creator      User          @relation(fields: [createdBy], references: [id])

  @@unique([memberId, competencyId, trackId])    // tránh gán trùng track cho cùng 1 gap
  @@index([orgId, memberId])
  @@map("member_idps")
}
```

---

### FR-3 — Tạo / cập nhật Manager Review

#### `PUT /organizations/:orgId/campaigns/:campaignId/members/:memberId/review`

**RBAC:** OWNER, ADMIN, MANAGER.

**Ngữ nghĩa:** Upsert — tạo mới nếu chưa có, cập nhật nếu đã có (unique: campaignId + memberId).

Request body:

```json
{
  "note": "Bạn thể hiện tốt ở domain Networking nhưng cần cải thiện Security.",
  "direction": "Tham gia LearningTrack Security Fundamentals trước Q4/2026."
}
```

**Validation:**

- `note`: required, tối đa 2000 ký tự.
- `direction`: optional, tối đa 2000 ký tự.
- `memberId` phải thuộc `orgId`.
- `campaignId` phải thuộc `orgId`.

Response `200`:

```json
{
  "id": "uuid",
  "campaignId": "uuid",
  "memberId": "uuid",
  "memberName": "Nguyen Van A",
  "note": "...",
  "direction": "...",
  "reviewedBy": "uuid",
  "reviewerName": "Tran Manager",
  "updatedAt": "ISO8601"
}
```

---

#### `GET /organizations/:orgId/campaigns/:campaignId/members/:memberId/review`

**RBAC:** OWNER, ADMIN, MANAGER; MEMBER chỉ xem review của chính mình.

Response `200`: object review hoặc `null` nếu chưa có review.

---

#### `GET /organizations/:orgId/campaigns/:campaignId/reviews`

**RBAC:** OWNER, ADMIN, MANAGER.

Response `200`: danh sách tất cả review trong campaign, kèm member name và reviewer name.

---

### FR-4 — Gợi ý LearningTrack theo gap

#### `GET /organizations/:orgId/members/:memberId/idp/suggestions`

**RBAC:** OWNER, ADMIN, MANAGER.

**Logic gợi ý:**

```
1. Load competency gap của member (từ CompetencyCertification + JobRoleCompetency):
   gap = requiredLevel - achievedLevel (chỉ lấy gap > 0 hoặc EXPIRED cert).
2. Load tất cả LearningTrack của org đang isActive.
3. Match: track.name ILIKE competency.name hoặc track.description ILIKE competency.name.
   → Nếu không có match → trả về tất cả track (manager tự chọn).
4. Trả về danh sách gợi ý kèm gap info.
```

Response `200`:

```json
{
  "memberId": "uuid",
  "memberName": "Nguyen Van A",
  "gaps": [
    {
      "competencyId": "uuid",
      "competencyName": "Security",
      "currentLevel": 2,
      "requiredLevel": 4,
      "gap": 2,
      "suggestedTracks": [
        {
          "trackId": "uuid",
          "trackName": "Security Fundamentals",
          "description": "Khóa nền tảng về bảo mật mạng"
        }
      ]
    }
  ]
}
```

---

### FR-5 — Tạo / cập nhật IDP

#### `POST /organizations/:orgId/members/:memberId/idp`

**RBAC:** OWNER, ADMIN, MANAGER.

Request body:

```json
{
  "competencyId": "uuid",
  "trackId": "uuid",
  "targetLevel": 4,
  "dueDate": "2026-12-31T00:00:00Z"
}
```

**Validation:**

- `competencyId` và `trackId` phải thuộc `orgId`.
- `targetLevel` trong khoảng `[competency.scaleMin, competency.scaleMax]`.
- Unique: (memberId, competencyId, trackId) — 409 nếu đã tồn tại.

Response `201`: IDP item đã tạo.

---

#### `GET /organizations/:orgId/members/:memberId/idp`

**RBAC:** OWNER, ADMIN, MANAGER; MEMBER chỉ xem IDP của chính mình.

Response `200`:

```json
{
  "memberId": "uuid",
  "memberName": "Nguyen Van A",
  "idp": [
    {
      "id": "uuid",
      "competencyName": "Security",
      "trackName": "Security Fundamentals",
      "targetLevel": 4,
      "dueDate": "2026-12-31T00:00:00Z",
      "completedAt": null,
      "status": "IN_PROGRESS"
    }
  ]
}
```

`status`: `IN_PROGRESS` (chưa xong, chưa hết hạn) · `OVERDUE` (hết hạn chưa xong) · `COMPLETED`.

---

#### `PATCH /organizations/:orgId/members/:memberId/idp/:idpId`

**RBAC:** OWNER, ADMIN, MANAGER.

Body: `{ "completedAt"?: ISO8601, "dueDate"?: ISO8601, "targetLevel"?: number }`.

Response `200`: IDP item đã cập nhật.

---

#### `DELETE /organizations/:orgId/members/:memberId/idp/:idpId`

**RBAC:** OWNER, ADMIN, MANAGER.

Response `204`.

---

## 3. Yêu cầu phi chức năng

| NFR                | Mô tả                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| **RBAC self-read** | MEMBER chỉ đọc review và IDP của chính mình; 403 nếu truy cập data người khác        |
| **Upsert review**  | `PUT review` idempotent — gọi lại cùng body → update, không tạo trùng                |
| **Soft data**      | IDP không hard-delete campaign data — chỉ xóa MemberIdp record, không ảnh hưởng cert |
| **Org isolation**  | Tất cả lookup filter theo `orgId`                                                    |

---

## 4. API Contract tổng hợp

| Method | Path                                                       | RBAC                             | Mô tả                        |
| ------ | ---------------------------------------------------------- | -------------------------------- | ---------------------------- |
| PUT    | `/organizations/:orgId/campaigns/:cid/members/:mid/review` | OWNER,ADMIN,MANAGER              | Upsert manager review        |
| GET    | `/organizations/:orgId/campaigns/:cid/members/:mid/review` | OWNER,ADMIN,MANAGER,MEMBER(self) | Xem review của member        |
| GET    | `/organizations/:orgId/campaigns/:cid/reviews`             | OWNER,ADMIN,MANAGER              | Tất cả review trong campaign |
| GET    | `/organizations/:orgId/members/:mid/idp/suggestions`       | OWNER,ADMIN,MANAGER              | Gợi ý LearningTrack theo gap |
| POST   | `/organizations/:orgId/members/:mid/idp`                   | OWNER,ADMIN,MANAGER              | Thêm IDP item                |
| GET    | `/organizations/:orgId/members/:mid/idp`                   | OWNER,ADMIN,MANAGER,MEMBER(self) | Xem IDP của member           |
| PATCH  | `/organizations/:orgId/members/:mid/idp/:idpId`            | OWNER,ADMIN,MANAGER              | Cập nhật IDP item            |
| DELETE | `/organizations/:orgId/members/:mid/idp/:idpId`            | OWNER,ADMIN,MANAGER              | Xóa IDP item                 |

---

## 5. Giao diện người dùng

### 5.1. Campaign Detail — tab "Đánh giá thành viên"

- Table: Member name | Điểm trung bình | Số competency đạt | Trạng thái review (Đã review / Chưa review).
- Click vào row → mở panel bên phải với form review (note + direction).
- Nút "Xem gap & gợi ý track" → load suggestions, cho phép tạo IDP ngay.

### 5.2. Member Profile — tab "Kế hoạch phát triển (IDP)"

- Bảng IDP: Năng lực | LearningTrack | Target Level | Deadline | Trạng thái.
- Badge IN_PROGRESS (xanh) / OVERDUE (đỏ) / COMPLETED (xám).
- Nút "Đánh dấu hoàn thành" (Manager).
- MEMBER xem readonly.

### 5.3. Campaign Detail — xem tổng quan review

- Thanh tiến độ "X / Y members đã được review".
- Filter: Đã review / Chưa review.

---

## 6. Test Cases

| #   | Tình huống                                       | Kết quả mong đợi                                       |
| --- | ------------------------------------------------ | ------------------------------------------------------ |
| T1  | Manager PUT review lần đầu                       | 200, review mới được tạo                               |
| T2  | Manager PUT review lần 2 cùng (campaign, member) | 200, review cũ được cập nhật (upsert)                  |
| T3  | MEMBER xem review của chính mình                 | 200, trả về review                                     |
| T4  | MEMBER xem review của member khác                | 403 Forbidden                                          |
| T5  | GET suggestions: member có gap Security level 2  | trả về tracks match "Security"                         |
| T6  | POST IDP với trackId không thuộc org             | 400 Bad Request                                        |
| T7  | POST IDP trùng (memberId, competencyId, trackId) | 409 Conflict                                           |
| T8  | PATCH IDP set completedAt                        | status = COMPLETED trong GET tiếp theo                 |
| T9  | GET IDP: dueDate đã qua, completedAt = null      | status = OVERDUE                                       |
| T10 | GET /campaigns/:id/reviews                       | trả về tất cả review trong campaign, kèm reviewer name |

---

## 7. Thứ tự implement

1. **Migration** — thêm `CampaignMemberReview`, `MemberIdp`.
2. **CampaignReviewService** — upsert review, list reviews per campaign.
3. **IdpService** — suggestions, CRUD IDP, status computation.
4. **Controllers** — mount review dưới campaigns, IDP dưới members.
5. **Module** — extend `campaigns.module.ts`; tạo `idp.module.ts` hoặc extend `competency.module.ts`.
6. **FE Campaign Detail** — tab "Đánh giá thành viên" + panel review + IDP modal.
7. **FE Member Profile** — tab IDP.
8. **Tests** — unit IdpService (T5, T8, T9), integration (full review + IDP flow).

---

## 8. Open Questions

- Gợi ý track hiện dùng text matching đơn giản. Có cần vector similarity không? (Đề xuất: text matching MVP; AI suggestion để Sprint 4+.)
- IDP có cần approval từ member không? (Đề xuất: không — manager tạo, member đọc; approval deferred.)
- Có cho MEMBER tự tạo IDP không? (Đề xuất: không trong MVP — chỉ Manager/Admin; self-serve để Sprint 4.)
