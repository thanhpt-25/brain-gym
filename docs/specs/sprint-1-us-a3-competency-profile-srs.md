# SRS — US-A3: Hồ sơ năng lực nhân viên & Bản đồ Gap

| | |
|---|---|
| **Tài liệu** | Software Requirements Specification (SRS) |
| **Tính năng** | US-A3 — Competency Profile & Gap Map |
| **Issue** | #97 |
| **Epic** | A — Khung năng lực & chuẩn theo vị trí |
| **Phiên bản** | Draft 1.0 |
| **Ngày** | 2026-06-17 |
| **Trạng thái** | Draft — chờ implement |
| **Phụ thuộc** | US-A1 (#95) và US-A2 (#96) phải hoàn thành trước |
| **Module liên quan** | `org-analytics` (backend) · `ReadinessHeatmap.tsx`, `SkillGapChart.tsx` (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-A3**, cho phép nhân viên/Manager xem hồ sơ năng lực hiện tại (suy ra từ kết quả thi `ExamAttempt`) so với chuẩn vị trí (`JobRoleCompetency.requiredLevel`), hiển thị dạng radar/heatmap với tô màu đạt/chưa đạt.

### 1.2. Phạm vi

**Trong phạm vi:**
- Suy ra bậc năng lực (`currentLevel`) từ `domainScores` của `ExamAttempt` bằng `inferCompetencyLevel()`.
- Endpoint analytics: profile per member + so với `requiredLevel` của job role.
- Endpoint analytics: heatmap tất cả member × tất cả competency.
- FE: radar chart per competency (đạt/chưa đạt), heatmap member × competency.
- RBAC: member thấy hồ sơ mình; MANAGER/ADMIN/OWNER thấy tất cả.

**Ngoài phạm vi:**
- Tính năng lực từ kết quả thi ứng viên bên ngoài (US-E2).
- Lộ trình học gợi ý (Sprint 2+).
- Export hồ sơ năng lực ra PDF.

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| **currentLevel** | Bậc năng lực hiện tại, suy ra từ domainScores của ExamAttempt |
| **requiredLevel** | Bậc yêu cầu từ JobRoleCompetency (US-A2) |
| **gap** | `requiredLevel - currentLevel`; dương = thiếu hụt; 0 hoặc âm = đạt |
| **confidence** | Độ tin cậy của currentLevel: LOW (<8 câu), MEDIUM (8-19), HIGH (≥20) |
| **inferCompetencyLevel** | Hàm thuần trong `competency/scoring/infer-competency-level.ts` |

### 1.4. Hiện trạng trước US-A3

- `inferCompetencyLevel(domainScores, mappedDomains, options)` — hàm thuần có test đầy đủ.
- `getSkillGaps()` trong `org-analytics.service.ts` — tổng hợp domain thô, **chưa map sang competency**.
- `ReadinessHeatmap.tsx` và `SkillGapChart.tsx` — components FE sẵn có, chưa wire với competency data.
- Schema: `ExamAttempt.domainScores (Json)`, `CompetencyDomain`, `JobRoleCompetency`.

---

## 2. Yêu cầu chức năng

### FR-1 — Endpoint: Hồ sơ năng lực per member

#### `GET /organizations/:orgId/analytics/competency-profile`

Query params:
- `memberId` (optional): userId của member; nếu không có → dùng authenticated user.
- `jobRoleId` (optional): nếu có → so sánh với `requiredLevel` của role đó.

**RBAC:**
- Member không truyền `memberId` (hoặc truyền userId của mình) → 200.
- Member truyền `memberId` của người khác → 403.
- MANAGER/ADMIN/OWNER → 200 cho bất kỳ memberId.

**Logic tính toán:**

```
1. Lấy tất cả ExamAttempt của member (status=SUBMITTED).
2. Aggregate domainScores thành map: { domainName: {correct, total} }.
3. Lấy tất cả Competency của org (isActive=true).
4. Với mỗi Competency:
   a. Lấy CompetencyDomain[] của competency đó.
   b. Gọi inferCompetencyLevel(aggregatedDomainScores, mappedDomains, {scaleMin, scaleMax, DEFAULT_THRESHOLDS_1_5}).
   c. Nếu jobRoleId được cung cấp: lấy requiredLevel từ JobRoleCompetency.
   d. Tính gap = requiredLevel - currentLevel (null nếu không có jobRoleId).
5. Trả về mảng kết quả.
```

Response `200`:
```json
[
  {
    "competencyId": "uuid",
    "competencyName": "AWS Networking",
    "currentLevel": 3,
    "requiredLevel": 4,
    "gap": 1,
    "confidence": "HIGH",
    "sampleSize": 25,
    "matchedDomains": ["Networking", "VPC"],
    "scaleMin": 1,
    "scaleMax": 5
  }
]
```

Khi không có `ExamAttempt` nào: `currentLevel = scaleMin`, `confidence = "LOW"`, `sampleSize = 0`.

---

### FR-2 — Endpoint: Heatmap org-wide

#### `GET /organizations/:orgId/analytics/competency-heatmap`

**RBAC:** MANAGER, ADMIN, OWNER.

Response `200`:
```json
{
  "competencies": [
    { "id": "uuid", "name": "AWS Networking", "scaleMin": 1, "scaleMax": 5 }
  ],
  "members": [
    {
      "userId": "uuid",
      "displayName": "Nguyen Van A",
      "scores": {
        "uuid-competency": {
          "currentLevel": 3,
          "confidence": "MEDIUM",
          "gap": 1
        }
      }
    }
  ]
}
```

Nếu không có `jobRoleId` context: `gap` = null.

**Cache:** Redis 5 phút với key `org-competency-heatmap:{orgId}`. Invalidate khi có ExamAttempt mới (webhook/event) hoặc khi CompetencyDomain thay đổi.

---

### FR-3 — FE: Radar chart per member

**Component:** Mở rộng hoặc tạo mới bên cạnh `SkillGapChart.tsx`.

**Hiển thị:**
- Trục radial: mỗi competency = một trục.
- Vùng màu xanh: currentLevel.
- Đường màu đỏ/cam: requiredLevel (nếu có jobRoleId).
- Tooltip: `{competencyName}: level {currentLevel}/{scaleMax}, gap {gap}, confidence {confidence}, {sampleSize} câu`.
- Badge "LOW confidence" màu vàng nếu confidence=LOW.

**Placement:** Tab mới "Năng lực" trong trang member profile hoặc trang Analytics của org.

---

### FR-4 — FE: Heatmap member × competency

**Component:** Mở rộng `ReadinessHeatmap.tsx`.

**Hiển thị:**
- Rows: member (hiển thị displayName).
- Columns: competency name.
- Cell: level số (1–5), màu nền theo cấp độ:
  - Xanh đậm: currentLevel ≥ requiredLevel (đạt).
  - Đỏ: currentLevel < requiredLevel (thiếu).
  - Xám nhạt: không có data (confidence=LOW, sampleSize=0).
- Tooltip: chi tiết gap, confidence, sampleSize.

---

## 3. Yêu cầu phi chức năng

| NFR | Mô tả |
|---|---|
| **RBAC member** | Member chỉ thấy hồ sơ của mình; vi phạm → 403 |
| **Fallback no data** | Competency không có ExamAttempt liên quan → currentLevel=scaleMin, confidence=LOW |
| **Cache** | Heatmap cache Redis 5 phút (nếu org >50 members); profile per member không cache |
| **Reuse hàm scoring** | Bắt buộc dùng `inferCompetencyLevel()` — không tự implement lại |
| **Performance** | Heatmap org-wide chạy < 2s cho 100 members × 20 competencies |

---

## 4. API Contract

| Method | Path | RBAC | Mô tả |
|---|---|---|---|
| GET | `/organizations/:orgId/analytics/competency-profile` | Tất cả (RBAC per memberId) | Hồ sơ năng lực per member |
| GET | `/organizations/:orgId/analytics/competency-heatmap` | MANAGER,ADMIN,OWNER | Heatmap org-wide |

---

## 5. Test Cases

| # | Tình huống | Kết quả |
|---|---|---|
| T1 | Member lấy profile của mình (không có jobRoleId) | 200, gap=null |
| T2 | Member lấy profile kèm jobRoleId | 200, gap tính đúng |
| T3 | Member lấy profile của người khác | 403 |
| T4 | MANAGER lấy profile của member bất kỳ | 200 |
| T5 | Member chưa có ExamAttempt | 200, currentLevel=scaleMin, confidence=LOW |
| T6 | Competency có domains match 25 câu đúng 20/25 | level=4 (80%→level 4 với thresholds 1–5) |
| T7 | MEMBER lấy heatmap org-wide | 403 |
| T8 | Heatmap với 0 member | `{ competencies: [...], members: [] }` |

---

## 6. Thứ tự implement

1. **US-A1 + US-A2 phải done** (Competency, CompetencyDomain, JobRoleCompetency đã có data).
2. Thêm `getCompetencyProfile(orgId, memberId, jobRoleId?)` vào `org-analytics.service.ts`.
3. Thêm `getCompetencyHeatmap(orgId)` với cache Redis.
4. Thêm 2 routes vào `org-analytics.controller.ts`.
5. FE service functions (`org-analytics.ts` hoặc `analytics.ts`).
6. FE `SkillGapChart.tsx` → radar competency.
7. FE `ReadinessHeatmap.tsx` → heatmap competency.
8. Tests (unit scoring + integration endpoint).
