# SRS — US-D1: Bộ đề duy nhất mỗi ứng viên + ngân hàng lớn

|                      |                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Tài liệu**         | Software Requirements Specification (SRS)                                                                                        |
| **Tính năng**        | US-D1 — Unique Question Sets per Candidate + Large Pool                                                                          |
| **Issue**            | [#105](https://github.com/thanhpt-25/brain-gym/issues/105)                                                                       |
| **Epic**             | D — Tăng cường chống gian lận                                                                                                    |
| **Phiên bản**        | Draft 1.0                                                                                                                        |
| **Ngày**             | 2026-06-21                                                                                                                       |
| **Trạng thái**       | Draft — chờ implement                                                                                                            |
| **Phụ thuộc**        | Nền tảng `drawFromPool` đã có (`assessments.service.ts` L176); `drawnQuestionIds` snapshot trên `CandidateInvite` (schema L1207) |
| **Module liên quan** | `assessments` (backend mở rộng) · Assessment Settings page (frontend mở rộng)                                                    |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-D1**, tăng cường tính ngẫu nhiên và độ phủ khi rút đề từ pool lớn: đảm bảo mỗi ứng viên nhận tổ hợp câu hỏi khác nhau, cung cấp báo cáo độ trùng đề giữa các ứng viên, và cảnh báo Recruiter khi pool quá nhỏ so với số ứng viên mời.

### 1.2. Phạm vi

**Trong phạm vi:**

- Kiểm tra pool size so với số candidate đã invite — cảnh báo khi pool quá nhỏ.
- Báo cáo overlap: tỷ lệ câu hỏi trùng giữa các invite trong cùng assessment (dựa trên `drawnQuestionIds`).
- Endpoint xem thống kê pool và overlap.
- Validation khi publish assessment ở chế độ POOL/BLUEPRINT: đủ câu hỏi cho dự kiến số ứng viên.
- Cải thiện `drawFromPool`: đảm bảo tối đa hóa sự khác biệt giữa các lần draw (prioritize least-used questions).

**Ngoài phạm vi:**

- Thay đổi cơ bản thuật toán POOL/BLUEPRINT (vẫn dùng random draw, chỉ thêm đảm bảo).
- Webcam proctoring (US-D3 Sprint 4).
- Phát hiện hành vi chia sẻ đáp án (analytics nâng cao — deferred).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ            | Ý nghĩa                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- | ----- | --- | ----- | ---------------------- |
| **Pool**             | Tập hợp câu hỏi có thể rút — từ `AssessmentQuestion` (MANUAL) hoặc cert/category (POOL mode)        |
| **drawnQuestionIds** | Snapshot array của câu hỏi đã rút cho invite này (`CandidateInvite.drawnQuestionIds`, schema L1207) |
| **Overlap ratio**    | Tỷ lệ câu hỏi trùng giữa 2 invite: `                                                                | A ∩ B | /   | A ∪ B | ` (Jaccard similarity) |
| **Pool coverage**    | Tỷ lệ câu hỏi trong pool đã được sử dụng bởi ít nhất 1 invite                                       |
| **Min pool ratio**   | Ngưỡng tối thiểu: pool size / draw count — khuyến nghị ≥ 3x để đảm bảo đa dạng                      |

### 1.4. Hiện trạng trước US-D1

- `Assessment.selectionMode` — MANUAL / POOL / BLUEPRINT — đã có.
- `Assessment.selectionConfig` JSON — cấu hình pool draw (`drawCount`, `certificationId`, `categories`) — đã có.
- `CandidateInvite.drawnQuestionIds` String[] — snapshot đã được lưu khi draw — đã có.
- `drawFromPool()` (`assessments.service.ts` L176) — rút ngẫu nhiên từ pool — đã có.
- Chưa có: kiểm tra pool size vs candidate count, báo cáo overlap, least-used draw priority.

---

## 2. Yêu cầu chức năng

### FR-1 — Kiểm tra pool size khi invite

Mở rộng `CandidateService.inviteCandidate()`:

**Trước khi tạo invite mới:**

1. Đếm pool size: số câu hỏi khả dụng theo `selectionConfig` của assessment.
2. Tính `drawCount` (số câu mỗi invite cần rút).
3. Nếu `poolSize / drawCount < MIN_POOL_RATIO` (mặc định 2.0):
   - **Không chặn** — vẫn tạo invite.
   - Trả về warning trong response: `{ "warning": "POOL_TOO_SMALL", "poolSize": 20, "drawCount": 15, "ratio": 1.33 }`.
4. Nếu `poolSize < drawCount`:
   - **Chặn** — 400 Bad Request: `"Không đủ câu hỏi trong pool (cần ${drawCount}, có ${poolSize})"`.

`MIN_POOL_RATIO` có thể cấu hình qua env var `POOL_MIN_RATIO` (default: `2.0`).

---

### FR-2 — Least-used draw priority

Cải thiện `drawFromPool()` để ưu tiên câu hỏi chưa hoặc ít được rút nhất:

**Thuật toán mới:**

```
1. Load pool candidates (như hiện tại).
2. Load usage count cho từng câu trong pool:
   usage[qId] = COUNT of invites in this assessment WHERE drawnQuestionIds CONTAINS qId
3. Sắp xếp pool theo usage ASC (ít dùng nhất → ưu tiên cao hơn).
4. Chia pool thành 2 nhóm:
   - low_use: usage <= percentile_25 của pool
   - rest: phần còn lại
5. Draw: 70% từ low_use (nếu đủ), 30% từ rest → shuffle kết quả cuối.
   Nếu low_use < 0.7 * drawCount → draw toàn random (fallback hiện tại).
6. Snapshot drawnQuestionIds như hiện tại.
```

> **Lưu ý hiệu năng:** Usage count query chạy một lần per invite. Khi pool > 5000 câu, thêm `@@index([assessmentId])` trên drawn_question_ids (array index PostgreSQL GIN).

---

### FR-3 — Báo cáo overlap

#### `GET /organizations/:orgId/assessments/:assessmentId/pool-stats`

**RBAC:** OWNER, ADMIN, MANAGER, RECRUITER.

**Tính toán:**

1. Load tất cả invite đã SUBMITTED của assessment, lấy `drawnQuestionIds`.
2. Tính pairwise Jaccard overlap cho tất cả cặp (O(n²) — giới hạn tính toán cho ≤ 500 invite; trả về `approximated: true` nếu vượt).
3. Tính pool coverage: distinct question IDs đã được dùng / pool size.

Response `200`:

```json
{
  "assessmentId": "uuid",
  "poolSize": 120,
  "drawCount": 30,
  "poolRatio": 4.0,
  "poolWarning": false,
  "totalInvites": 45,
  "submittedInvites": 38,
  "poolCoverage": 0.87,
  "overlap": {
    "approximated": false,
    "avgJaccard": 0.12,
    "maxJaccard": 0.31,
    "highOverlapPairs": [
      {
        "invite1": "uuid",
        "invite2": "uuid",
        "candidate1": "nguyenvana@example.com",
        "candidate2": "tranthib@example.com",
        "jaccard": 0.31,
        "sharedQuestions": 9
      }
    ]
  },
  "usageDistribution": {
    "used0Times": 15,
    "used1Time": 42,
    "used2To5Times": 38,
    "usedOver5Times": 25
  }
}
```

`highOverlapPairs`: tất cả cặp có `jaccard > 0.3` (configurable).

---

### FR-4 — Cảnh báo khi publish assessment

Mở rộng `POST /organizations/:orgId/assessments/:assessmentId/publish`:

**Thêm pool validation trước khi publish** (chỉ áp dụng với selectionMode = POOL hoặc BLUEPRINT):

1. Tính pool size theo `selectionConfig`.
2. Nếu `poolSize / drawCount < 2.0` → trả về warning trong response (không chặn publish).
3. Nếu `poolSize < drawCount` → **chặn publish** với 400: `"Pool không đủ câu hỏi để phát đề"`.

---

### FR-5 — Hiển thị pool info trong Assessment Settings

#### `GET /organizations/:orgId/assessments/:assessmentId/pool-info`

**RBAC:** OWNER, ADMIN, MANAGER.

Response `200`:

```json
{
  "selectionMode": "POOL",
  "poolSize": 120,
  "drawCount": 30,
  "poolRatio": 4.0,
  "warning": null,
  "recommendedPoolSize": 90
}
```

`recommendedPoolSize = drawCount * MIN_POOL_RATIO * 1.5` (buffer 50%).

`warning`: `null` | `"POOL_TOO_SMALL"` | `"POOL_CRITICAL"` (ratio < 1.5).

---

## 3. Yêu cầu phi chức năng

| NFR                 | Mô tả                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **Backward compat** | `drawFromPool` fallback về random thuần nếu usage data không có hoặc pool quá nhỏ                         |
| **Performance**     | Pool-stats tính toán pairwise chỉ với ≤ 500 invite; vượt ngưỡng → `approximated: true`, sample 200 invite |
| **Non-blocking**    | Pool size warning không chặn invite — chỉ thêm field `warning` trong response                             |
| **Pool isolation**  | Mỗi assessment có pool riêng; drawnQuestionIds không chia sẻ giữa assessment                              |
| **GIN index**       | Thêm GIN index trên `candidate_invites.drawn_question_ids` nếu query scan > 1000 rows                     |

---

## 4. API Contract tổng hợp

| Method | Path                                                | RBAC                          | Mô tả                        |
| ------ | --------------------------------------------------- | ----------------------------- | ---------------------------- |
| GET    | `/organizations/:orgId/assessments/:aid/pool-stats` | OWNER,ADMIN,MANAGER,RECRUITER | Overlap report + pool stats  |
| GET    | `/organizations/:orgId/assessments/:aid/pool-info`  | OWNER,ADMIN,MANAGER           | Pool size check cho settings |

_(Các endpoint invite và publish đã có — chỉ mở rộng logic.)_

---

## 5. Giao diện người dùng

### 5.1. Assessment Settings — card "Pool & Đề thi"

- Hiển thị: Pool size / Draw count / Pool ratio.
- Badge cảnh báo: "⚠ Pool nhỏ (ratio 1.3x — khuyến nghị ≥ 2x)" màu vàng nếu ratio < 2.
- Badge nguy hiểm: "✗ Pool không đủ (cần 30 câu, có 25)" màu đỏ nếu poolSize < drawCount.
- Nút "Xem báo cáo đề" → mở trang pool-stats.

### 5.2. Trang Pool Stats (`/org/:slug/assessments/:id/pool-stats`)

- Cards: Pool coverage % | Avg overlap | Max overlap | Số cặp overlap cao.
- Table "Cặp ứng viên overlap cao": Ứng viên 1 | Ứng viên 2 | % trùng | Số câu trùng.
- Bar chart: phân phối usage (dùng 0 lần / 1 lần / 2-5 lần / >5 lần).

### 5.3. Invite flow — warning

Khi Recruiter invite và pool ratio thấp:

- Toast warning màu vàng: "Lưu ý: pool câu hỏi nhỏ (ratio 1.3x). Xem xét thêm câu hỏi để giảm trùng đề."
- Invite vẫn được tạo bình thường.

---

## 6. Test Cases

| #   | Tình huống                                          | Kết quả mong đợi                                                |
| --- | --------------------------------------------------- | --------------------------------------------------------------- |
| T1  | Pool 30 câu, draw 30 → invite                       | Invite thành công nhưng warning POOL_CRITICAL (ratio=1.0)       |
| T2  | Pool 25 câu, draw 30 → invite                       | 400 Bad Request "Pool không đủ"                                 |
| T3  | Pool 120 câu, draw 30 → invite                      | Invite thành công, không warning                                |
| T4  | 2 invite với pool 30 câu, draw 15 (ratio=2)         | avgJaccard < 0.5, drawnQuestionIds khác nhau đáng kể            |
| T5  | drawFromPool: 10 câu dùng 0 lần, 20 câu dùng 5+ lần | Draw ưu tiên 10 câu chưa dùng (xuất hiện nhiều hơn trong drawn) |
| T6  | GET pool-stats: 2 invite share 9/30 câu             | jaccard = 9/(30+30-9) = 0.176                                   |
| T7  | Publish assessment với poolSize < drawCount         | 400 chặn publish                                                |
| T8  | GET pool-stats assessment selectionMode=MANUAL      | poolSize = số câu MANUAL, overlap tính bình thường              |
| T9  | GET pool-stats > 500 invite                         | approximated=true, tính sample 200 invite                       |
| T10 | Tạo invite thứ 2 trong pool nhỏ: least-used draw    | Câu hỏi chưa dùng xuất hiện với tần suất cao hơn                |

---

## 7. Thứ tự implement

1. **Pool validation** — mở rộng `inviteCandidate()`: đếm pool size, trả về warning/error.
2. **Least-used draw** — cải thiện `drawFromPool()` với usage-aware selection.
3. **pool-info endpoint** — truy vấn đơn giản, không cần migration.
4. **pool-stats endpoint** — tính Jaccard overlap + coverage; thêm GIN index nếu cần.
5. **Publish validation** — mở rộng publish endpoint với pool check.
6. **FE Assessment Settings** — card Pool info + badge warning.
7. **FE Pool Stats page** — overlap table + usage chart.
8. **Tests** — unit drawFromPool (T4, T5), unit Jaccard (T6), integration (T1, T2, T3, T7).

---

## 8. Open Questions

- Least-used draw có tốn quá nhiều query không khi pool lớn? (Đề xuất: Redis cache usage map per assessment, TTL 5 phút.)
- `MIN_POOL_RATIO = 2.0` — có nên cấu hình per-org không? (Đề xuất: env var global MVP; per-org setting để Sprint 4.)
- Threshold `highOverlapPairs > 0.3` — hardcode hay configurable per assessment? (Đề xuất: configurable field trên `Assessment` — default 0.3.)
