# SRS — US-D2: Proctoring nâng cao & cờ rủi ro

|                      |                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tài liệu**         | Software Requirements Specification (SRS)                                                                                                                                            |
| **Tính năng**        | US-D2 — Advanced Proctoring & Risk Flags                                                                                                                                             |
| **Issue**            | [#106](https://github.com/thanhpt-25/brain-gym/issues/106)                                                                                                                           |
| **Epic**             | D — Tăng cường chống gian lận                                                                                                                                                        |
| **Phiên bản**        | Draft 1.0                                                                                                                                                                            |
| **Ngày**             | 2026-06-21                                                                                                                                                                           |
| **Trạng thái**       | Draft — chờ implement                                                                                                                                                                |
| **Phụ thuộc**        | `CandidateEvent` (schema L1245) đã có; `calcIntegrityScore()` (`candidate.service.ts` L413) đã có; `getEvents()` (L396) đã có; `CandidateInvite.integrityScore` (schema L1201) đã có |
| **Module liên quan** | `assessments` (backend mở rộng) · `AssessmentResults` page (frontend mở rộng)                                                                                                        |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-D2**, cho phép Recruiter xem nhật ký sự kiện `CandidateEvent` dưới dạng timeline trực quan trong trang kết quả, với cờ rủi ro tự động theo ngưỡng cấu hình được, và filter ứng viên theo `integrityScore`.

### 1.2. Phạm vi

**Trong phạm vi:**

- API trả về `CandidateEvent` timeline cho một invite.
- Cấu hình ngưỡng rủi ro per-assessment: `riskThreshold` (integrity score tối thiểu để được coi là "sạch").
- Endpoint filter ứng viên theo `integrityScore < riskThreshold`.
- Đánh dấu (flag) ứng viên nghi vấn: field `isFlagged` trên invite, set bởi Recruiter hoặc tự động.
- Timeline UI trong Candidate Detail / Assessment Results.
- Badge "Nghi vấn" trên candidate list khi integrityScore thấp.

**Ngoài phạm vi:**

- Webcam snapshot / xác thực danh tính (US-D3, Sprint 4).
- AI phân tích hành vi nâng cao (deferred).
- Gửi email cảnh báo khi phát hiện gian lận (deferred).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ          | Ý nghĩa                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| **CandidateEvent** | Sự kiện hành vi trong khi thi: `tab_switch`, `fullscreen_exit`, `paste`, `focus_lost`, `copy` v.v.    |
| **integrityScore** | Điểm toàn vẹn 0–100 (`CandidateInvite.integrityScore`), giảm dần khi có sự kiện vi phạm               |
| **riskThreshold**  | Ngưỡng dưới ngưỡng này ứng viên được tự động flag — cấu hình per-assessment (default: 70)             |
| **isFlagged**      | Boolean trên `CandidateInvite`: `true` nếu tự động hoặc thủ công đánh dấu nghi vấn                    |
| **RiskLevel**      | LOW (score ≥ threshold) · MEDIUM (threshold - 20 ≤ score < threshold) · HIGH (score < threshold - 20) |

### 1.4. Hiện trạng trước US-D2

- `CandidateEvent` (schema L1245): `id`, `inviteId`, `eventType`, `payload`, `clientTs` — đã được ghi từ exam engine.
- `CandidateInvite.integrityScore` (schema L1201) — đã tính và lưu khi submit.
- `calcIntegrityScore()` (`candidate.service.ts` L413) — đã có.
- `getEvents(inviteId, assessmentId)` (`candidate.service.ts` L396) — đã có, trả về raw events.
- `CandidateInvite.tabSwitchCount` (schema L1199) — đã có.
- Chưa có: `riskThreshold` trên Assessment, `isFlagged` trên CandidateInvite, timeline UI, filter theo integrity.

---

## 2. Yêu cầu chức năng

### FR-1 — Schema: thêm risk fields

**Mở rộng `Assessment`:**

```prisma
riskThreshold  Int  @default(70) @map("risk_threshold")  // integrityScore min để "sạch"
autoFlagRisk   Boolean @default(true) @map("auto_flag_risk") // tự động flag khi submit
```

**Mở rộng `CandidateInvite`:**

```prisma
isFlagged      Boolean   @default(false) @map("is_flagged")
flaggedAt      DateTime? @map("flagged_at")
flaggedReason  String?   @map("flagged_reason")  // "AUTO_LOW_INTEGRITY" | "MANUAL" | null
flaggedBy      String?   @map("flagged_by")       // userId nếu manual
```

---

### FR-2 — Tự động flag khi submit

Mở rộng `CandidateService.submitExam()`:

```
Sau khi tính integrityScore:
IF assessment.autoFlagRisk = true AND integrityScore < assessment.riskThreshold:
  invite.isFlagged = true
  invite.flaggedAt = now()
  invite.flaggedReason = "AUTO_LOW_INTEGRITY"
```

---

### FR-3 — Event timeline endpoint

#### `GET /organizations/:orgId/assessments/:assessmentId/candidates/:inviteId/events`

**RBAC:** OWNER, ADMIN, MANAGER, RECRUITER.

**Xử lý:** Gọi `getEvents(inviteId, assessmentId)`, nhóm theo `eventType`, sort `clientTs ASC`.

Response `200`:

```json
{
  "inviteId": "uuid",
  "candidateName": "Nguyen Van A",
  "candidateEmail": "nguyenvana@example.com",
  "integrityScore": 58,
  "riskThreshold": 70,
  "riskLevel": "HIGH",
  "isFlagged": true,
  "totalEvents": 14,
  "summary": {
    "tab_switch": 6,
    "fullscreen_exit": 4,
    "paste": 2,
    "focus_lost": 2
  },
  "timeline": [
    {
      "id": "uuid",
      "eventType": "tab_switch",
      "clientTs": "2026-06-15T10:03:22Z",
      "relativeMinute": 3,
      "payload": { "url": "" },
      "severity": "HIGH"
    },
    {
      "id": "uuid",
      "eventType": "paste",
      "clientTs": "2026-06-15T10:07:45Z",
      "relativeMinute": 7,
      "payload": { "length": 142 },
      "severity": "MEDIUM"
    }
  ]
}
```

**Severity per eventType:**

| eventType         | severity |
| ----------------- | -------- |
| `tab_switch`      | HIGH     |
| `fullscreen_exit` | MEDIUM   |
| `paste`           | HIGH     |
| `copy`            | MEDIUM   |
| `focus_lost`      | LOW      |
| others            | LOW      |

**`relativeMinute`**: số phút kể từ `invite.startedAt`.

---

### FR-4 — Thủ công flag / unflag

#### `PATCH /organizations/:orgId/assessments/:assessmentId/candidates/:inviteId/flag`

**RBAC:** OWNER, ADMIN, MANAGER, RECRUITER.

Request body:

```json
{
  "isFlagged": true,
  "reason": "Phát hiện chia sẻ đáp án qua chat"
}
```

**Xử lý:**

- `isFlagged = true`: set `flaggedAt = now()`, `flaggedReason = "MANUAL"`, `flaggedBy = currentUserId`.
- `isFlagged = false`: clear `flaggedAt`, `flaggedReason`, `flaggedBy` (unflag).

Response `200`: invite đã cập nhật (`isFlagged`, `flaggedAt`, `flaggedReason`).

---

### FR-5 — Cấu hình riskThreshold

#### `PATCH /organizations/:orgId/assessments/:assessmentId/risk-config`

**RBAC:** OWNER, ADMIN, MANAGER.

Request body:

```json
{
  "riskThreshold": 65,
  "autoFlagRisk": true
}
```

**Validation:**

- `riskThreshold`: integer 0–100.
- `autoFlagRisk`: boolean.

Response `200`: assessment đã cập nhật.

**Side effect:** Thay đổi `riskThreshold` **không** hồi tố — không tự động re-flag các invite đã submit.

---

### FR-6 — Filter candidates theo risk

Mở rộng `GET /organizations/:orgId/assessments/:assessmentId/candidates`:

**Thêm query params:**

- `maxIntegrity?: number` — chỉ trả về invite có `integrityScore <= maxIntegrity`.
- `isFlagged?: boolean` — lọc theo flag.
- `riskLevel?: LOW | MEDIUM | HIGH` — tính toán theo threshold của assessment.

Response item bổ sung:

```json
{
  "inviteId": "uuid",
  "candidateName": "...",
  "integrityScore": 58,
  "riskLevel": "HIGH",
  "isFlagged": true,
  "flaggedReason": "AUTO_LOW_INTEGRITY",
  "tabSwitchCount": 6
}
```

---

## 3. Yêu cầu phi chức năng

| NFR                    | Mô tả                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------- |
| **RBAC**               | Candidate không tự xem events của mình; 403 nếu cố truy cập                            |
| **Org isolation**      | inviteId phải thuộc assessmentId phải thuộc orgId; chain validation 3 cấp              |
| **Non-retroactive**    | Thay đổi riskThreshold sau submit không tự re-flag invite cũ                           |
| **Append-only events** | CandidateEvent chỉ ghi, không sửa/xóa; timeline luôn immutable                         |
| **Performance**        | Tối đa 1000 events per invite; nếu > 1000 → trả về 1000 events đầu + `truncated: true` |

---

## 4. API Contract tổng hợp

| Method | Path                                                            | RBAC                          | Mô tả                     |
| ------ | --------------------------------------------------------------- | ----------------------------- | ------------------------- |
| GET    | `/organizations/:orgId/assessments/:aid/candidates/:iid/events` | OWNER,ADMIN,MANAGER,RECRUITER | Event timeline của invite |
| PATCH  | `/organizations/:orgId/assessments/:aid/candidates/:iid/flag`   | OWNER,ADMIN,MANAGER,RECRUITER | Thủ công flag / unflag    |
| PATCH  | `/organizations/:orgId/assessments/:aid/risk-config`            | OWNER,ADMIN,MANAGER           | Cấu hình riskThreshold    |

_(GET candidates đã có — chỉ mở rộng query params.)_

---

## 5. Giao diện người dùng

### 5.1. Assessment Results — cột risk

Trong bảng danh sách ứng viên:

- Cột "Integrity" hiển thị score (0–100) + badge risk level: 🟢 LOW / 🟡 MEDIUM / 🔴 HIGH.
- Icon 🚩 nếu `isFlagged = true`.
- Filter bar: "Chỉ hiện nghi vấn" checkbox → `isFlagged=true`; slider "Integrity tối đa: 70".

### 5.2. Candidate Detail — tab "Giám sát"

- Header: Integrity score lớn + badge risk + flagged badge (nếu có).
- Card tóm tắt: Tab switch: 6 | Fullscreen exit: 4 | Paste: 2.
- Timeline dọc (CSS timeline component):
  - Mỗi event là một node: icon + eventType label + thời gian tương đối ("3 phút sau khi bắt đầu") + severity badge.
  - Màu node: đỏ (HIGH) / vàng (MEDIUM) / xám (LOW).
- Nút "Đánh dấu nghi vấn" / "Bỏ đánh dấu" → gọi PATCH flag.

### 5.3. Assessment Settings — tab "Proctoring"

- Toggle "Tự động đánh dấu khi integrity thấp".
- Slider/input "Ngưỡng integrity: [70]".
- Label: "Ứng viên có integrity < 70 sẽ được tự động đánh dấu nghi vấn".

---

## 6. Test Cases

| #   | Tình huống                                                        | Kết quả mong đợi                                                      |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| T1  | Submit với integrityScore=55, riskThreshold=70, autoFlagRisk=true | isFlagged=true, flaggedReason="AUTO_LOW_INTEGRITY"                    |
| T2  | Submit với integrityScore=85, riskThreshold=70, autoFlagRisk=true | isFlagged=false                                                       |
| T3  | Submit với integrityScore=55, autoFlagRisk=false                  | isFlagged=false (auto-flag tắt)                                       |
| T4  | PATCH flag {isFlagged: true, reason: "manual"}                    | flaggedReason="MANUAL", flaggedBy=currentUserId                       |
| T5  | PATCH flag {isFlagged: false}                                     | isFlagged=false, flaggedAt/reason/by cleared                          |
| T6  | GET events: 6 tab_switch, 2 paste                                 | summary.tab_switch=6, severity HIGH cho tab_switch                    |
| T7  | GET candidates?isFlagged=true                                     | Chỉ trả về invite có isFlagged=true                                   |
| T8  | GET candidates?maxIntegrity=60                                    | Chỉ trả về invite có integrityScore <= 60                             |
| T9  | GET candidates?riskLevel=HIGH với threshold=70                    | Chỉ trả về invite có score < 50 (threshold-20)                        |
| T10 | Candidate thử GET events của chính mình                           | 403 Forbidden                                                         |
| T11 | PATCH risk-config riskThreshold=60 sau khi có invite đã flagged   | Invite cũ không bị re-flag/unflag; chỉ invite mới submit bị ảnh hưởng |
| T12 | GET events > 1000 events                                          | Trả về 1000 đầu, truncated=true                                       |

---

## 7. Thứ tự implement

1. **Migration** — thêm `riskThreshold`, `autoFlagRisk` vào `Assessment`; `isFlagged`, `flaggedAt`, `flaggedReason`, `flaggedBy` vào `CandidateInvite`.
2. **Auto-flag trong submitExam()** — mở rộng `CandidateService.submitExam()`.
3. **risk-config endpoint** — PATCH assessment risk settings.
4. **Events timeline endpoint** — wrap `getEvents()` + tính severity + relativeMinute.
5. **Flag/unflag endpoint** — PATCH flag.
6. **Candidates filter** — mở rộng query params trên GET candidates.
7. **FE Assessment Results** — cột integrity + filter + badge.
8. **FE Candidate Detail** — tab Giám sát + timeline component.
9. **FE Assessment Settings** — tab Proctoring.
10. **Tests** — unit (T1–T3), integration (T6, T7, T8), E2E candidate detail tab.

---

## 8. Open Questions

- `relativeMinute` tính từ `invite.startedAt` — nếu `startedAt` null thì sao? (Đề xuất: dùng event đầu tiên làm baseline; log warning nếu startedAt missing.)
- Có nên lưu `riskLevel` vào DB hay tính on-the-fly? (Đề xuất: tính on-the-fly từ integrityScore + threshold; tránh stale data khi threshold thay đổi.)
- Có cần `AuditLog` khi flag/unflag thủ công không? (Đề xuất: có — ghi vào existing `AuditLog` model với action `CANDIDATE_FLAGGED` / `CANDIDATE_UNFLAGGED`.)
