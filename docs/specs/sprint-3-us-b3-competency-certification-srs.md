# SRS — US-B3: Chứng nhận năng lực nội bộ & hạn hiệu lực

|                      |                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tài liệu**         | Software Requirements Specification (SRS)                                                                                                                                   |
| **Tính năng**        | US-B3 — Internal Competency Certification with Expiry                                                                                                                       |
| **Issue**            | [#100](https://github.com/thanhpt-25/brain-gym/issues/100)                                                                                                                  |
| **Epic**             | B — Chu kỳ đánh giá năng lực định kỳ                                                                                                                                        |
| **Phiên bản**        | Draft 1.0                                                                                                                                                                   |
| **Ngày**             | 2026-06-21                                                                                                                                                                  |
| **Trạng thái**       | Draft — chờ implement                                                                                                                                                       |
| **Phụ thuộc**        | **US-A1 (#95), US-A2 (#96) closed Sprint 1** ✓ — `Competency`, `JobRoleCompetency` đã có; **US-B1 (#98) closed Sprint 2** ✓ — `AssessmentCampaign`, campaign progress đã có |
| **Module liên quan** | `competency` (backend mới) · `campaigns` (backend mở rộng) · `src/pages/org/` (frontend)                                                                                    |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-B3**, cho phép hệ thống tự động cấp _chứng nhận năng lực nội bộ_ (`CompetencyCertification`) khi nhân viên đạt ngưỡng `requiredLevel` trong một đợt đánh giá, lưu `achievedLevel` và `expiresAt`, đồng thời cảnh báo khi chứng nhận sắp hết hạn hoặc đã hết hạn.

### 1.2. Phạm vi

**Trong phạm vi:**

- Model `CompetencyCertification` — lưu chứng nhận của member cho từng competency, bao gồm `achievedLevel`, `expiresAt`, và `campaignId` gốc.
- Service `CompetencyCertService.issueByCampaign(campaignId)` — duyệt kết quả campaign, so với `JobRoleCompetency.requiredLevel`, tự cấp cert.
- Endpoint kích hoạt cấp cert sau khi campaign kết thúc.
- Endpoint xem danh sách cert của member / của org (với filter sắp hết hạn / đã hết hạn).
- Báo cáo compliance: danh sách member chưa có cert hoặc cert đã hết hạn theo competency.
- RBAC: OWNER/ADMIN/MANAGER xem báo cáo; MEMBER tự xem cert của mình.

**Ngoài phạm vi:**

- Gửi email thông báo sắp hết hạn (thuộc US-B2/email module, để Sprint 4).
- Cert cho recruiting candidate (chỉ cho internal member).
- Gia hạn cert thủ công bởi Manager (deferred).
- Public cert link để chia sẻ bên ngoài org (deferred).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ                   | Ý nghĩa                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| **CompetencyCertification** | Bản ghi chứng nhận: member đạt level X cho competency Y, có hiệu lực đến `expiresAt`              |
| **achievedLevel**           | Level đạt được (integer, trong thang `scaleMin`–`scaleMax` của Competency)                        |
| **requiredLevel**           | `JobRoleCompetency.requiredLevel` — ngưỡng tối thiểu để pass và được cấp cert                     |
| **expiresAt**               | Thời điểm cert hết hạn (mặc định: `issuedAt + validityMonths`, cấu hình theo org hoặc competency) |
| **CertStatus**              | ACTIVE (còn hạn) · EXPIRING_SOON (≤ 30 ngày) · EXPIRED (quá hạn)                                  |
| **ComplianceGap**           | Member có cert EXPIRED hoặc chưa có cert cho một competency bắt buộc theo JobRole                 |

### 1.4. Hiện trạng trước US-B3

- `Competency` (schema L1660): `id`, `orgId`, `name`, `scaleMin`, `scaleMax` — đã có.
- `JobRoleCompetency` (schema L1712): `jobRoleId`, `competencyId`, `requiredLevel` — đã có.
- `AssessmentCampaign` (schema L1067): campaign INTERNAL với status DRAFT/ACTIVE/CLOSED — đã có.
- `OrgMember` — liên kết user với org — đã có.
- Chưa có model `CompetencyCertification`.
- Chưa có service/controller cấp cert.
- Chưa có FE trang cert hoặc báo cáo compliance.

---

## 2. Yêu cầu chức năng

### FR-1 — Schema mới: `CompetencyCertification`

Thêm vào `prisma/schema.prisma`:

```prisma
model CompetencyCertification {
  id            String    @id @default(uuid())
  orgId         String    @map("org_id")
  memberId      String    @map("member_id")
  competencyId  String    @map("competency_id")
  campaignId    String?   @map("campaign_id")      // nguồn cấp cert
  achievedLevel Int       @map("achieved_level")
  issuedAt      DateTime  @default(now()) @map("issued_at")
  expiresAt     DateTime  @map("expires_at")
  revokedAt     DateTime? @map("revoked_at")       // soft-revoke nếu cần

  organization Organization       @relation(fields: [orgId], references: [id], onDelete: Cascade)
  member       OrgMember          @relation(fields: [memberId], references: [id], onDelete: Cascade)
  competency   Competency         @relation(fields: [competencyId], references: [id], onDelete: Restrict)
  campaign     AssessmentCampaign? @relation(fields: [campaignId], references: [id])

  @@unique([memberId, competencyId, issuedAt])    // tránh cấp trùng cùng thời điểm
  @@index([orgId, competencyId])
  @@index([memberId])
  @@index([expiresAt])
  @@map("competency_certifications")
}
```

**Mở rộng `Competency`:**

```prisma
validityMonths  Int  @default(12) @map("validity_months")  // TTL cert tính theo tháng
```

---

### FR-2 — Cấp cert theo campaign

#### `POST /organizations/:orgId/campaigns/:campaignId/issue-certifications`

**RBAC:** OWNER, ADMIN.

**Điều kiện:** Campaign phải ở trạng thái `CLOSED`.

**Thuật toán:**

```
1. Load campaign → lấy tất cả OrgExamAssignment của campaign.
2. Với mỗi assignment → load CandidateInvite (qua catalogItemId → assessment → invite của member).
3. Load scorecard (reuse ScorecardService.buildForCandidate từ US-E3) với jobRoleId của campaign.
4. Với mỗi CompetencyScoreItem:
   a. Nếu passed = true:
      - Kiểm tra đã có cert ACTIVE cho (memberId, competencyId) chưa?
        → Nếu có và achievedLevel >= item.normalizedLevel → skip (không downgrade).
        → Nếu có nhưng achievedLevel < item.normalizedLevel → issue cert mới (upgrade).
        → Nếu chưa có → issue cert mới.
      - expiresAt = now() + competency.validityMonths tháng.
5. Return summary: { issued, skipped, upgraded }.
```

**Response `200`:**

```json
{
  "campaignId": "uuid",
  "issued": 12,
  "upgraded": 2,
  "skipped": 5,
  "certifications": [
    {
      "memberId": "uuid",
      "memberName": "Nguyen Van A",
      "competencyId": "uuid",
      "competencyName": "Cloud Networking",
      "achievedLevel": 4,
      "expiresAt": "2027-06-21T00:00:00Z",
      "action": "ISSUED"
    }
  ]
}
```

**Lỗi:**

- `400` nếu campaign chưa CLOSED.
- `404` nếu campaign không thuộc orgId.
- `409` nếu đã chạy issue cho campaign này (idempotent: re-run safe, skip existing).

---

### FR-3 — Xem cert của member

#### `GET /organizations/:orgId/members/:memberId/certifications`

**RBAC:** OWNER, ADMIN, MANAGER; MEMBER chỉ xem cert của chính mình.

Query params: `status?: ACTIVE | EXPIRING_SOON | EXPIRED | ALL` (default: ALL)

**Tính `status` on-the-fly:**

```
EXPIRING_SOON: expiresAt <= now() + 30 ngày AND expiresAt > now() AND revokedAt IS NULL
EXPIRED:       expiresAt <= now() OR revokedAt IS NOT NULL
ACTIVE:        expiresAt > now() + 30 ngày AND revokedAt IS NULL
```

**Response `200`:**

```json
{
  "memberId": "uuid",
  "memberName": "Nguyen Van A",
  "certifications": [
    {
      "id": "uuid",
      "competencyId": "uuid",
      "competencyName": "Cloud Networking",
      "achievedLevel": 4,
      "scaleMax": 5,
      "issuedAt": "2026-06-21T00:00:00Z",
      "expiresAt": "2027-06-21T00:00:00Z",
      "status": "ACTIVE",
      "campaignName": "Đánh giá Q2/2026"
    }
  ]
}
```

---

### FR-4 — Báo cáo compliance

#### `GET /organizations/:orgId/certifications/compliance`

**RBAC:** OWNER, ADMIN.

Query params: `competencyId?`, `groupId?`, `status?: ACTIVE | EXPIRING_SOON | EXPIRED`

**Mục đích:** Danh sách member theo trạng thái cert cho từng competency bắt buộc. Phục vụ dashboard điều hành (US-G1).

**Response `200`:**

```json
{
  "summary": {
    "totalMembers": 45,
    "certified": 30,
    "expiringSoon": 5,
    "expired": 4,
    "notCertified": 6
  },
  "rows": [
    {
      "memberId": "uuid",
      "memberName": "Tran Thi B",
      "competencyId": "uuid",
      "competencyName": "Security",
      "certStatus": "EXPIRED",
      "expiresAt": "2026-01-15T00:00:00Z",
      "achievedLevel": 3,
      "requiredLevel": 4
    }
  ]
}
```

---

### FR-5 — Xem cert theo org

#### `GET /organizations/:orgId/certifications`

**RBAC:** OWNER, ADMIN, MANAGER.

Query params: `competencyId?`, `groupId?`, `status?`, `page`, `limit` (default 20).

Response `200`: paginated list của `CompetencyCertification` kèm member name, competency name, status.

---

## 3. Yêu cầu phi chức năng

| NFR                   | Mô tả                                                                          |
| --------------------- | ------------------------------------------------------------------------------ |
| **Idempotent issue**  | Gọi lại `issue-certifications` nhiều lần → skip cert đã có (không tạo trùng)   |
| **No downgrade**      | Không ghi cert mới nếu `achievedLevel` mới thấp hơn cert ACTIVE hiện tại       |
| **RBAC member scope** | MEMBER chỉ đọc cert của chính mình; 403 nếu truy cập cert của người khác       |
| **Org isolation**     | Mọi query filter theo `orgId`; competency của org khác không visible           |
| **Index expiry**      | `@@index([expiresAt])` — cho cron job quét hết hạn và báo cáo compliance       |
| **Soft-revoke**       | `revokedAt IS NOT NULL` = cert bị thu hồi; không xóa vật lý để giữ audit trail |

---

## 4. API Contract tổng hợp

| Method | Path                                                       | RBAC                             | Mô tả                                  |
| ------ | ---------------------------------------------------------- | -------------------------------- | -------------------------------------- |
| POST   | `/organizations/:orgId/campaigns/:id/issue-certifications` | OWNER, ADMIN                     | Cấp cert hàng loạt sau campaign CLOSED |
| GET    | `/organizations/:orgId/members/:memberId/certifications`   | OWNER,ADMIN,MANAGER,MEMBER(self) | Cert của member                        |
| GET    | `/organizations/:orgId/certifications`                     | OWNER,ADMIN,MANAGER              | Danh sách cert toàn org                |
| GET    | `/organizations/:orgId/certifications/compliance`          | OWNER, ADMIN                     | Báo cáo compliance gap                 |

---

## 5. Giao diện người dùng

### 5.1. Campaign Detail — nút "Cấp chứng nhận"

- Hiển thị khi `campaign.status = CLOSED`.
- Nút "Cấp chứng nhận năng lực" → gọi POST issue-certifications → hiện modal kết quả (X cấp mới, Y nâng cấp, Z bỏ qua).

### 5.2. Member Profile — tab "Chứng nhận"

- Bảng: Năng lực | Level đạt được | Ngày cấp | Hết hạn | Trạng thái (badge ACTIVE / EXPIRING / EXPIRED).
- Filter theo trạng thái.

### 5.3. Trang Compliance (`/org/:slug/competency/compliance`)

- Summary cards: Đã chứng nhận / Sắp hết hạn / Đã hết hạn / Chưa có cert.
- Table chi tiết với filter group, competency, status.
- Nút "Xuất CSV".

---

## 6. Test Cases

| #   | Tình huống                                                 | Kết quả mong đợi                             |
| --- | ---------------------------------------------------------- | -------------------------------------------- |
| T1  | Issue cert cho campaign CLOSED, member passed 2 competency | 2 CompetencyCertification mới, action=ISSUED |
| T2  | Issue cert cho campaign ACTIVE (chưa CLOSED)               | 400 Bad Request                              |
| T3  | Member đã có cert ACTIVE level 4; tái đánh giá đạt level 3 | skip (không downgrade), action=SKIPPED       |
| T4  | Member đã có cert ACTIVE level 3; tái đánh giá đạt level 4 | cert mới level 4 được cấp, action=UPGRADED   |
| T5  | Gọi issue-certifications lần 2 cùng campaign               | Tất cả SKIPPED, không trùng lặp              |
| T6  | GET certifications với status=EXPIRING_SOON                | Chỉ cert có expiresAt trong 30 ngày tới      |
| T7  | MEMBER xem cert của member khác                            | 403 Forbidden                                |
| T8  | GET compliance: 5 member thiếu cert Security               | summary.notCertified=5, rows đúng            |
| T9  | Competency validityMonths=6; issue cert                    | expiresAt = issuedAt + 6 tháng               |
| T10 | ADMIN revoke cert (set revokedAt)                          | status=EXPIRED trong response tiếp theo      |

---

## 7. Thứ tự implement

1. **Migration** — thêm `CompetencyCertification`, field `validityMonths` vào `Competency`.
2. **CompetencyCertService** — `issueByCampaign`, `findByMember`, `findByOrg`, `getCompliance`.
3. **CompetencyCertController** — 4 endpoints; RBAC guards.
4. **Module** — tạo `competency-cert.module.ts`, import vào `OrgsModule`.
5. **FE Campaign Detail** — nút "Cấp chứng nhận" + modal kết quả.
6. **FE Member Profile** — tab Chứng nhận.
7. **FE Compliance page** — `/org/:slug/competency/compliance`.
8. **Tests** — unit CompetencyCertService (T1–T5), integration (full flow campaign CLOSED → issue → GET).

---

## 8. Open Questions

- `issue-certifications` nên chạy tự động khi campaign chuyển CLOSED không? (Đề xuất: thủ công MVP — Admin nhấn nút; auto-trigger để Sprint 4.)
- Cần email thông báo sắp hết hạn không? (Đề xuất: defer — đã có US-C3 email template cho Sprint 4.)
- `validityMonths` cấu hình per-competency hay per-org? (Đề xuất: per-competency, default 12 tháng — linh hoạt hơn.)
