# SRS — US-E3: Scorecard theo năng lực của vị trí

|                      |                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Tài liệu**         | Software Requirements Specification (SRS)                                                                               |
| **Tính năng**        | US-E3 — Competency Scorecard per Role                                                                                   |
| **Issue**            | [#110](https://github.com/thanhpt-25/brain-gym/issues/110)                                                              |
| **Epic**             | E — Tự động sàng lọc & xếp hạng                                                                                         |
| **Phiên bản**        | Draft 1.0                                                                                                               |
| **Ngày**             | 2026-06-20                                                                                                              |
| **Trạng thái**       | Draft — chờ implement                                                                                                   |
| **Phụ thuộc**        | **US-A1 (#95) và US-A2 (#96) đã closed trong Sprint 1** ✓ — `Competency`, `CompetencyDomain`, `JobRoleCompetency` đã có |
| **Module liên quan** | `competency` (backend) · `assessments` (backend) · Candidate detail page (frontend)                                     |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-E3**, cho phép Hiring Manager xem điểm ứng viên quy về từng năng lực của vị trí, so sánh trực tiếp với chuẩn `JobRoleCompetency.requiredLevel`, để đánh giá độ phù hợp theo chiều năng lực thay vì chỉ nhìn tổng điểm.

### 1.2. Phạm vi

**Trong phạm vi:**

- Model `ExamDomainCompetency` — map domain câu hỏi (`OrgQuestion.category` hoặc `Domain.name`) sang một `Competency` với trọng số.
- Service `ScorecardService.buildForCandidate(inviteId, jobRoleId)` — tổng hợp điểm domain → competency → so với `requiredLevel`.
- Endpoint `GET /candidates/:inviteId/scorecard?jobRoleId=`.
- Admin UI: mapping editor domain → competency trên trang Assessment detail.
- Candidate detail UI: scorecard panel với pass/fail per competency.
- Export scorecard CSV.

**Ngoài phạm vi:**

- Scorecard cho exam thông thường (chỉ cho recruiting assessment).
- Tích hợp scorecard vào ScreeningRule (US-E1) — để Sprint 3.
- So sánh nhiều ứng viên trong cùng view.

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ                | Ý nghĩa                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| **ExamDomainCompetency** | Bảng map: (assessmentId, domainKey, competencyId, weight) — 1 domain → 1 competency            |
| **domainKey**            | String key trong `CandidateInvite.domainScores` JSON (tên category của OrgQuestion)            |
| **CompetencyScore**      | Điểm tổng hợp của ứng viên cho 1 competency, tính từ weighted average các domain đã map        |
| **requiredLevel**        | `JobRoleCompetency.requiredLevel` — ngưỡng tối thiểu để pass, theo thang `scaleMin`–`scaleMax` |
| **normalizedScore**      | CompetencyScore quy về thang scaleMin–scaleMax để so sánh trực tiếp với `requiredLevel`        |

### 1.4. Hiện trạng trước US-E3

- `Competency` (schema.prisma L1598): `id`, `orgId`, `name`, `scaleMin`, `scaleMax`.
- `CompetencyDomain` (L1619): `competencyId`, `domainName`, `source` (ORG_QUESTION_CATEGORY / PUBLIC_DOMAIN).
- `JobRoleCompetency` (L1649): `jobRoleId`, `competencyId`, `requiredLevel`.
- `CandidateInvite.domainScores`: JSON `{ "Networking": 82, "Security": 74, ... }` — có sẵn sau submit.
- Chưa có `ExamDomainCompetency` (mapping có trọng số domain → competency cho từng assessment).
- Chưa có `ScorecardService`. Chưa có scorecard endpoint hoặc UI.

---

## 2. Yêu cầu chức năng

### FR-1 — Schema mới: `ExamDomainCompetency`

```prisma
model ExamDomainCompetency {
  id           String   @id @default(uuid())
  assessmentId String   @map("assessment_id")
  domainKey    String   @map("domain_key")     // key trong domainScores JSON
  competencyId String   @map("competency_id")
  weight       Float    @default(1.0)           // trọng số khi nhiều domain → cùng competency
  createdAt    DateTime @default(now()) @map("created_at")

  assessment Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  competency Competency  @relation(fields: [competencyId], references: [id], onDelete: Cascade)

  @@unique([assessmentId, domainKey])
  @@index([assessmentId])
  @@index([competencyId])
  @@map("exam_domain_competencies")
}
```

> **Lưu ý:** 1 domain → tối đa 1 competency (unique constraint). Nhiều domain có thể → cùng 1 competency với weight khác nhau.

---

### FR-2 — Admin: quản lý domain mapping

#### `GET /organizations/:orgId/assessments/:aid/domain-mapping`

Response `200`: danh sách domain keys trong assessment này kèm competency đã map (nếu có):

```json
[
  {
    "domainKey": "Networking",
    "competencyId": "uuid",
    "competencyName": "Cloud Networking",
    "weight": 1.0
  },
  {
    "domainKey": "Security",
    "competencyId": null,
    "competencyName": null,
    "weight": null
  }
]
```

> Domain keys được suy ra từ `CandidateInvite.domainScores` của các invite thuộc assessment này (lấy distinct keys).

---

#### `PUT /organizations/:orgId/assessments/:aid/domain-mapping`

**RBAC:** OWNER, ADMIN, MANAGER.

Request body (upsert toàn bộ mapping cho assessment):

```json
[
  { "domainKey": "Networking", "competencyId": "uuid", "weight": 1.5 },
  { "domainKey": "Security", "competencyId": "uuid", "weight": 1.0 }
]
```

**Xử lý:** Prisma upsert theo `(assessmentId, domainKey)`. Cho phép `competencyId = null` để xóa mapping.

Response `200`: danh sách mapping đã lưu.

**Validation:**

- `competencyId` phải thuộc cùng `orgId`.
- `weight > 0`.
- `domainKey` phải là string không rỗng.

---

### FR-3 — ScorecardService.buildForCandidate

```typescript
interface CompetencyScoreItem {
  competencyId: string;
  competencyName: string;
  scaleMin: number;
  scaleMax: number;
  rawScore: number; // weighted average điểm domain (0–100)
  normalizedLevel: number; // quy về scaleMin–scaleMax, làm tròn 1 chữ số thập phân
  requiredLevel: number; // từ JobRoleCompetency
  passed: boolean; // normalizedLevel >= requiredLevel
  domains: {
    domainKey: string;
    score: number; // từ domainScores JSON
    weight: number;
  }[];
}
```

**Thuật toán:**

```
1. Load invite.domainScores (JSON), inviteId → assessmentId.
2. Load ExamDomainCompetency WHERE assessmentId = invite.assessmentId.
3. Load JobRoleCompetency WHERE jobRoleId = :jobRoleId.
4. Group mappings by competencyId:
   Với mỗi competency:
   a. Lọc domains có mapping VÀ có điểm trong invite.domainScores.
   b. rawScore = Σ(score[domain] * weight[domain]) / Σ(weight[domain])  [weighted average 0–100]
   c. normalizedLevel = scaleMin + (rawScore / 100) * (scaleMax - scaleMin)
      → làm tròn 1 chữ số thập phân
   d. passed = normalizedLevel >= requiredLevel
5. Chỉ trả về competency có trong JobRoleCompetency (có requiredLevel).
6. Competency có trong JobRole nhưng domain chưa map → rawScore=null, passed=false, note='Chưa có dữ liệu'.
```

---

### FR-4 — Endpoint scorecard

#### `GET /organizations/:orgId/assessments/:aid/candidates/:inviteId/scorecard`

Query params: `jobRoleId` (required).

**RBAC:** OWNER, ADMIN, MANAGER, RECRUITER (không cho MEMBER/candidate xem).

**Validation:**

- `inviteId` phải thuộc `assessmentId` và `orgId`.
- `jobRoleId` phải thuộc `orgId`.
- Invite phải có `status = SUBMITTED` (chưa submit → 400).

Response `200`:

```json
{
  "inviteId": "uuid",
  "candidateName": "Nguyen Van A",
  "jobRoleId": "uuid",
  "jobRoleTitle": "Cloud Engineer",
  "overallPassed": false,
  "passedCount": 2,
  "totalCount": 3,
  "items": [
    {
      "competencyId": "uuid",
      "competencyName": "Cloud Networking",
      "scaleMin": 1,
      "scaleMax": 5,
      "rawScore": 82.5,
      "normalizedLevel": 4.1,
      "requiredLevel": 4,
      "passed": true,
      "domains": [
        { "domainKey": "Networking", "score": 85, "weight": 1.5 },
        { "domainKey": "VPC", "score": 78, "weight": 1.0 }
      ]
    },
    {
      "competencyId": "uuid",
      "competencyName": "Security",
      "scaleMin": 1,
      "scaleMax": 5,
      "rawScore": 60.0,
      "normalizedLevel": 3.4,
      "requiredLevel": 4,
      "passed": false,
      "domains": [{ "domainKey": "Security", "score": 60, "weight": 1.0 }]
    }
  ]
}
```

`overallPassed = true` chỉ khi **tất cả** competency đều passed.

---

### FR-5 — Export scorecard CSV

#### `GET /organizations/:orgId/assessments/:aid/candidates/:inviteId/scorecard/csv?jobRoleId=`

Response `200` với `Content-Type: text/csv`:

```
Candidate,Email,JobRole,Competency,Raw Score (%),Level,Required Level,Passed
Nguyen Van A,nguyenvana@example.com,Cloud Engineer,Cloud Networking,82.5,4.1,4,Yes
Nguyen Van A,nguyenvana@example.com,Cloud Engineer,Security,60.0,3.4,4,No
```

---

## 3. Yêu cầu phi chức năng

| NFR              | Mô tả                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------- |
| **Read-only**    | ScorecardService chỉ đọc — không ghi vào DB; kết quả tính on-the-fly                  |
| **Caching**      | Nếu cùng (inviteId, jobRoleId) request nhiều lần, có thể cache 5 phút trong Redis     |
| **RBAC**         | Candidate không tự xem scorecard của mình; chỉ recruiter/manager xem                  |
| **Precision**    | `normalizedLevel` làm tròn 1 chữ số thập phân; `rawScore` làm tròn 2 chữ số thập phân |
| **Missing data** | Domain không có trong `domainScores` → bỏ qua; competency không đủ domain → note rõ   |

---

## 4. API Contract tổng hợp

| Method | Path                                                                   | RBAC                          | Mô tả                 |
| ------ | ---------------------------------------------------------------------- | ----------------------------- | --------------------- |
| GET    | `/organizations/:orgId/assessments/:aid/domain-mapping`                | OWNER,ADMIN,MANAGER,RECRUITER | Xem domain mapping    |
| PUT    | `/organizations/:orgId/assessments/:aid/domain-mapping`                | OWNER,ADMIN,MANAGER           | Upsert domain mapping |
| GET    | `/organizations/:orgId/assessments/:aid/candidates/:iid/scorecard`     | OWNER,ADMIN,MANAGER,RECRUITER | Scorecard JSON        |
| GET    | `/organizations/:orgId/assessments/:aid/candidates/:iid/scorecard/csv` | OWNER,ADMIN,MANAGER,RECRUITER | Scorecard CSV export  |

---

## 5. Giao diện người dùng

### 5.1. Assessment Settings — tab "Domain Mapping"

- Table: Domain key (trái) → Competency picker (dropdown) → Weight (input số).
- Domain keys tự động lấy từ invite data của assessment.
- Nút "Lưu mapping" → gọi PUT domain-mapping.
- Warning nếu domain chưa được map: "X domain chưa gắn năng lực".

### 5.2. Candidate Detail — tab "Scorecard"

- Dropdown chọn JobRole (auto-fill nếu assessment có `jobRoleId`).
- Bảng competency:
  - Cột: Năng lực | Điểm ứng viên (level) | Chuẩn yêu cầu | Kết quả.
  - Level hiển thị dạng: `4.1 / 5` với progress bar.
  - Badge PASS (xanh) / FAIL (đỏ).
- Summary header: "Đạt 2/3 năng lực".
- Nút "Tải CSV" → gọi /scorecard/csv.

### 5.3. Expandable domain detail

Click vào row competency → expand danh sách domain con với điểm từng domain và weight.

---

## 6. Test Cases

| #   | Tình huống                                                       | Kết quả mong đợi                                    |
| --- | ---------------------------------------------------------------- | --------------------------------------------------- |
| T1  | 2 domain → 1 competency, weight 1.5 và 1.0, scores 80 và 60      | rawScore = (80×1.5 + 60×1.0) / 2.5 = 72.0           |
| T2  | normalizedLevel với scaleMin=1, scaleMax=5, rawScore=72          | normalizedLevel = 1 + (72/100)×4 = 3.9              |
| T3  | requiredLevel=4, normalizedLevel=3.9                             | passed = false                                      |
| T4  | Competency trong JobRole nhưng không có domain mapping           | rawScore=null, passed=false, note='Chưa có dữ liệu' |
| T5  | Domain có trong mapping nhưng không có trong invite.domainScores | Domain bị bỏ qua khỏi weighted average              |
| T6  | GET scorecard với invite chưa SUBMITTED                          | 400 Bad Request                                     |
| T7  | GET scorecard với jobRoleId thuộc org khác                       | 404 Not Found                                       |
| T8  | MEMBER thử GET scorecard                                         | 403 Forbidden                                       |
| T9  | PUT domain-mapping với competencyId thuộc org khác               | 400 Bad Request                                     |
| T10 | overallPassed: 3/3 competency passed                             | overallPassed = true                                |
| T11 | CSV export: 3 competency → 3 rows, header đúng                   | 200, Content-Type: text/csv, 3 data rows            |

---

## 7. Thứ tự implement

1. **Migration** — thêm `ExamDomainCompetency`.
2. **DomainMappingService** — GET distinct domain keys, upsert mapping.
3. **ScorecardService** — `buildForCandidate(inviteId, jobRoleId)` với thuật toán weighted average + normalize.
4. **ScorecardController** — mount endpoints dưới assessment candidates.
5. **CSV export** — generate trong service, stream response.
6. **FE domain mapping tab** — trong Assessment Settings.
7. **FE scorecard panel** — trong Candidate detail.
8. **Tests** — unit ScorecardService (T1–T5), integration (full flow submit → scorecard), E2E.

---

## 8. Open Questions

- Nếu 1 domain map sang 2 competency khác nhau (tương lai) → cần bỏ `UNIQUE(assessmentId, domainKey)`. MVP giữ 1-1. Confirm?
- Cache scorecard Redis: key `scorecard:{inviteId}:{jobRoleId}`, TTL 5 phút. Invalidate khi domain-mapping thay đổi. Có cần không? (Đề xuất: defer đến khi có performance issue.)
- `overallPassed` có nên lưu vào `CandidateInvite` không để filter nhanh? (Đề xuất: tính on-the-fly MVP; thêm computed field sau nếu cần.)
