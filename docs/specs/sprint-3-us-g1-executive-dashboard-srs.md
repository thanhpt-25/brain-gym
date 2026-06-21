# SRS — US-G1: Dashboard điều hành cho lãnh đạo

|                      |                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tài liệu**         | Software Requirements Specification (SRS)                                                                                                          |
| **Tính năng**        | US-G1 — Executive Leadership Dashboard                                                                                                             |
| **Issue**            | [#113](https://github.com/thanhpt-25/brain-gym/issues/113)                                                                                         |
| **Epic**             | G — Báo cáo, tuân thủ & dữ liệu                                                                                                                    |
| **Phiên bản**        | Draft 1.0                                                                                                                                          |
| **Ngày**             | 2026-06-21                                                                                                                                         |
| **Trạng thái**       | Draft — chờ implement                                                                                                                              |
| **Phụ thuộc**        | `org-analytics.service.ts` đã có; US-B3 (CompetencyCertification) nên hoàn thành trước để có cert data; US-D1/D2 (integrity data) cần submit đã có |
| **Module liên quan** | `analytics` (backend mở rộng) · `src/pages/org/` (frontend mới) · `src/components/org/` (frontend tái dùng)                                        |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-G1**, cung cấp cho OWNER/ADMIN một dashboard điều hành tổng hợp toàn org: compliance đào tạo theo competency, recruiting funnel, và integrity summary — với lát cắt theo group/jobRole/competency — và xuất báo cáo PDF/CSV.

### 1.2. Phạm vi

**Trong phạm vi:**

- **Competency compliance track**: % member đạt cert theo competency và jobRole, gap chart theo phòng ban.
- **Recruiting funnel track**: số ứng viên theo từng stage (APPLIED → SHORTLISTED → HIRED/REJECTED), conversion rate.
- **Integrity summary**: phân phối integrityScore, tỷ lệ flagged, tổng số sự kiện vi phạm theo assessment.
- Lát cắt (filter): theo `groupId`, `jobRoleId`, `competencyId`, khoảng thời gian.
- Xuất CSV toàn bộ dữ liệu.
- RBAC: chỉ OWNER và ADMIN.

**Ngoài phạm vi:**

- Real-time streaming (dashboard refresh mỗi giây) — batch query đủ.
- Drill-down đến từng cá nhân từ dashboard (link đến trang member profile đã có).
- PDF export phía server (dùng browser print CSS cho MVP).
- Benchmark so sánh với org khác (deferred).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ             | Ý nghĩa                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| **Compliance rate**   | % member có cert ACTIVE cho một competency bắt buộc / tổng member có jobRole cần competency đó |
| **Funnel stage**      | `CandidateStage`: APPLIED → SHORTLISTED → HIRED hoặc REJECTED                                  |
| **Conversion rate**   | % chuyển đổi giữa hai stage kế tiếp trong funnel                                               |
| **Integrity summary** | Phân phối `integrityScore` và tỷ lệ `isFlagged` theo assessment hoặc toàn org                  |
| **Executive slice**   | Một lát cắt báo cáo: có thể là toàn org, một group, một jobRole, hoặc một competency           |

### 1.4. Hiện trạng trước US-G1

- `analytics.service.ts` — có các metric cơ bản (attempt stats, domain breakdown) — đã có.
- `OrgMember`, `OrgGroup`, `JobRole`, `Competency`, `JobRoleCompetency` — đã có.
- `CompetencyCertification` — sẽ có sau US-B3.
- `CandidateInvite` với `stage`, `integrityScore`, `isFlagged` — đã có (isFlagged sau US-D2).
- `AssessmentCampaign` — đã có.
- Chưa có: executive dashboard endpoints, PDF/CSV export tổng hợp, compliance + funnel + integrity aggregation trong một service.

---

## 2. Yêu cầu chức năng

### FR-1 — Executive Summary Endpoint

#### `GET /organizations/:orgId/executive-dashboard`

**RBAC:** OWNER, ADMIN.

Query params:

| Param          | Mô tả               | Default       |
| -------------- | ------------------- | ------------- |
| `groupId`      | Lọc theo group      | all groups    |
| `jobRoleId`    | Lọc theo job role   | all roles     |
| `competencyId` | Lọc theo competency | all           |
| `from`         | ISO8601 — từ ngày   | 90 ngày trước |
| `to`           | ISO8601 — đến ngày  | now()         |

Response `200`:

```json
{
  "generatedAt": "2026-06-21T08:00:00Z",
  "period": { "from": "2026-03-23", "to": "2026-06-21" },
  "filters": { "groupId": null, "jobRoleId": null, "competencyId": null },
  "competencyCompliance": {
    "overallRate": 0.72,
    "totalMembers": 45,
    "certifiedMembers": 32,
    "expiringSoon": 4,
    "expired": 5,
    "notCertified": 4,
    "byCompetency": [
      {
        "competencyId": "uuid",
        "competencyName": "Cloud Networking",
        "requiredForRoles": 3,
        "certifiedCount": 18,
        "totalEligible": 22,
        "complianceRate": 0.82
      }
    ],
    "byGroup": [
      {
        "groupId": "uuid",
        "groupName": "Engineering",
        "complianceRate": 0.91,
        "memberCount": 12
      }
    ]
  },
  "recruitingFunnel": {
    "period": { "from": "2026-03-23", "to": "2026-06-21" },
    "totalCandidates": 124,
    "byStage": {
      "APPLIED": 124,
      "SHORTLISTED": 48,
      "HIRED": 11,
      "REJECTED": 65
    },
    "conversionRates": {
      "appliedToShortlisted": 0.387,
      "shortlistedToHired": 0.229,
      "overallYield": 0.089
    },
    "byAssessment": [
      {
        "assessmentId": "uuid",
        "assessmentTitle": "Backend Engineer Test",
        "totalInvites": 56,
        "shortlisted": 22,
        "hired": 5
      }
    ]
  },
  "integritySummary": {
    "totalSubmitted": 113,
    "flaggedCount": 8,
    "flaggedRate": 0.071,
    "avgIntegrityScore": 84,
    "scoreDistribution": {
      "90-100": 45,
      "70-89": 42,
      "50-69": 18,
      "0-49": 8
    },
    "topViolationEvents": [
      { "eventType": "tab_switch", "count": 142 },
      { "eventType": "fullscreen_exit", "count": 87 },
      { "eventType": "paste", "count": 31 }
    ]
  }
}
```

---

### FR-2 — Competency Compliance Detail

#### `GET /organizations/:orgId/executive-dashboard/compliance`

**RBAC:** OWNER, ADMIN.

Query params: `competencyId?`, `groupId?`, `jobRoleId?`, `status?: ACTIVE | EXPIRING_SOON | EXPIRED | NOT_CERTIFIED`.

Response `200`:

```json
{
  "rows": [
    {
      "memberId": "uuid",
      "memberName": "Nguyen Van A",
      "groupName": "Engineering",
      "jobRoleTitle": "Cloud Engineer",
      "competencyName": "Security",
      "certStatus": "EXPIRED",
      "achievedLevel": 3,
      "requiredLevel": 4,
      "expiresAt": "2026-01-15T00:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 50
}
```

_(Tái dùng data từ FR-4 của US-B3 `/certifications/compliance` — chỉ thêm pagination.)_

---

### FR-3 — Recruiting Funnel Detail

#### `GET /organizations/:orgId/executive-dashboard/funnel`

**RBAC:** OWNER, ADMIN.

Query params: `assessmentId?`, `jobRoleId?`, `from?`, `to?`.

Response `200`:

```json
{
  "rows": [
    {
      "inviteId": "uuid",
      "candidateName": "Tran Thi B",
      "candidateEmail": "tranthib@example.com",
      "assessmentTitle": "Backend Engineer Test",
      "jobRoleTitle": "Backend Engineer",
      "stage": "SHORTLISTED",
      "score": 87.5,
      "integrityScore": 92,
      "isFlagged": false,
      "submittedAt": "2026-06-10T14:23:00Z"
    }
  ],
  "total": 124,
  "page": 1,
  "limit": 50
}
```

---

### FR-4 — Xuất CSV

#### `GET /organizations/:orgId/executive-dashboard/export?type=compliance|funnel|integrity`

**RBAC:** OWNER, ADMIN.

Response `200` với `Content-Type: text/csv; charset=utf-8`:

**type=compliance:**

```
Member,Group,JobRole,Competency,Cert Status,Achieved Level,Required Level,Expires At
Nguyen Van A,Engineering,Cloud Engineer,Security,EXPIRED,3,4,2026-01-15
```

**type=funnel:**

```
Candidate,Email,Assessment,Job Role,Stage,Score,Integrity Score,Flagged,Submitted At
Tran Thi B,tranthib@example.com,Backend Engineer Test,Backend Engineer,SHORTLISTED,87.5,92,No,2026-06-10
```

**type=integrity:**

```
Candidate,Email,Assessment,Integrity Score,Flagged,Tab Switches,Paste Events,Submitted At
...
```

---

### FR-5 — In / xuất PDF

Không có server-side PDF generation trong MVP. Frontend cung cấp:

- Nút "In báo cáo" → `window.print()` với CSS `@media print` ẩn sidebar/nav, hiện đầy đủ dashboard.
- Tiêu đề in tự động kèm org name + date range.

---

## 3. Yêu cầu phi chức năng

| NFR                  | Mô tả                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| **RBAC strict**      | Chỉ OWNER và ADMIN; MANAGER/MEMBER → 403 ngay cả khi biết URL                                    |
| **Response time**    | Executive summary ≤ 3s cho org ≤ 500 members và ≤ 1000 invites; vượt ngưỡng → cache Redis 5 phút |
| **Cache key**        | `exec-dashboard:{orgId}:{filters_hash}` với TTL 5 phút                                           |
| **Cache invalidate** | Invalidate khi có cert mới được issue, invite mới submit, hoặc flag thay đổi                     |
| **Pagination**       | Detail endpoints (FR-2, FR-3) phân trang; summary (FR-1) không phân trang (aggregated)           |
| **Time zone**        | Tất cả datetime trả về ISO8601 UTC; frontend tự convert theo browser timezone                    |

---

## 4. API Contract tổng hợp

| Method | Path                                                   | RBAC         | Mô tả                                    |
| ------ | ------------------------------------------------------ | ------------ | ---------------------------------------- |
| GET    | `/organizations/:orgId/executive-dashboard`            | OWNER, ADMIN | Summary: compliance + funnel + integrity |
| GET    | `/organizations/:orgId/executive-dashboard/compliance` | OWNER, ADMIN | Compliance detail + pagination           |
| GET    | `/organizations/:orgId/executive-dashboard/funnel`     | OWNER, ADMIN | Recruiting funnel detail                 |
| GET    | `/organizations/:orgId/executive-dashboard/export`     | OWNER, ADMIN | CSV export (type param)                  |

---

## 5. Giao diện người dùng

### 5.1. Trang Executive Dashboard (`/org/:slug/executive`)

**Header:** Org name · Filter bar (Group / JobRole / Competency / Date range) · Nút "Xuất CSV" · Nút "In PDF".

**Section 1 — Compliance Overview:**

- 4 KPI cards: % Đạt cert | Sắp hết hạn | Đã hết hạn | Chưa có cert.
- Bar chart: Compliance rate theo competency (horizontal bars, sorted ASC).
- Bar chart: Compliance rate theo group.
- Link "Xem chi tiết" → `/org/:slug/competency/compliance`.

**Section 2 — Recruiting Funnel:**

- Funnel chart (SVG/D3 hoặc custom CSS): APPLIED → SHORTLISTED → HIRED với con số và %.
- Table "Theo assessment": Assessment title | Tổng invite | Shortlisted | Hired | Conversion %.
- Link "Xem chi tiết ứng viên" → trang Assessment Results đã có.

**Section 3 — Integrity Summary:**

- KPI: Tỷ lệ flagged % | Avg integrity score | Tổng sự kiện vi phạm.
- Donut chart: phân phối score (90-100 / 70-89 / 50-69 / 0-49).
- List: Top vi phạm (tab_switch: 142 lần, ...).

### 5.2. Responsive và Print

- Desktop: 3-column grid cho KPI cards; 2-column cho charts.
- Print CSS: full-width single-column; ẩn sidebar, filter bar, nav; hiện org name + date range + timestamp.

---

## 6. Test Cases

| #   | Tình huống                                                 | Kết quả mong đợi                                    |
| --- | ---------------------------------------------------------- | --------------------------------------------------- |
| T1  | MANAGER GET executive-dashboard                            | 403 Forbidden                                       |
| T2  | OWNER GET summary: 32/45 members certified                 | overallRate = 0.711, certifiedMembers = 32          |
| T3  | Filter ?groupId=X: chỉ tính members thuộc group X          | Kết quả scope xuống group X                         |
| T4  | Filter ?from=2026-01-01&to=2026-03-31: funnel chỉ trong Q1 | byStage.APPLIED chỉ đếm invite submittedAt trong Q1 |
| T5  | GET compliance?status=EXPIRED                              | Chỉ trả về rows có certStatus=EXPIRED               |
| T6  | GET export?type=compliance                                 | 200, Content-Type: text/csv, rows đúng cột          |
| T7  | GET summary: org chưa có cert nào (US-B3 chưa chạy)        | certifiedMembers=0, overallRate=0, không lỗi        |
| T8  | GET summary: gọi lần 2 trong 5 phút                        | Response từ Redis cache (X-Cache: HIT header)       |
| T9  | Issue cert mới → gọi GET summary                           | Cache invalidated, response fresh                   |
| T10 | GET funnel?jobRoleId=X                                     | Chỉ tính invite thuộc assessment có jobRoleId=X     |

---

## 7. Thứ tự implement

1. **ExecutiveDashboardService** — tổng hợp query compliance + funnel + integrity; dùng `prisma.$transaction` để parallel query.
2. **Cache layer** — Redis cache với key + TTL 5 phút; invalidation hooks sau cert issue và submit.
3. **ExecutiveDashboardController** — 4 endpoints; RBAC OWNER/ADMIN guard.
4. **Module** — thêm vào `analytics.module.ts` hoặc tạo `executive.module.ts`.
5. **CSV export** — stream response; 3 type.
6. **FE Executive Dashboard page** — route `/org/:slug/executive`, 3 sections.
7. **FE Charts** — reuse components từ `src/components/org/*`; thêm funnel chart.
8. **FE Print CSS** — `@media print` stylesheet.
9. **Tests** — unit ExecutiveDashboardService (T2–T4, T7), integration (T1, T5, T6), cache (T8, T9).

---

## 8. Open Questions

- Compliance rate tính theo "tất cả member" hay chỉ "member có jobRole"? (Đề xuất: chỉ member có jobRole với `requiredLevel` cho competency đó — có meaningful hơn.)
- Funnel period: filter theo `invite.submittedAt` hay `invite.createdAt`? (Đề xuất: `submittedAt` — muốn biết ai đã thi trong kỳ; `createdAt` để filter deferred.)
- Có cần scheduled report (email PDF hàng tuần cho OWNER) không? (Đề xuất: deferred Sprint 4 — cần US-C3 email template trước.)
- `X-Cache: HIT` header có cần không? (Đề xuất: có — dễ debug; set trong Redis cache middleware.)
