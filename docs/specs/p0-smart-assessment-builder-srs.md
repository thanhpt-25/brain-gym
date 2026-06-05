# SRS — P0: Smart Assessment Builder

| | |
|---|---|
| **Tài liệu** | Software Requirements Specification (SRS) |
| **Tính năng** | P0 — Smart Assessment Builder (Tạo đề thông minh cho Enterprise) |
| **Phiên bản** | 1.0 (Implemented) |
| **Ngày** | 2026-06-05 |
| **Trạng thái** | Đã triển khai — tài liệu hóa sau implement |
| **Phụ thuộc** | Không (P0 là phase đầu tiên) |
| **Module liên quan** | `assessments` (backend) · `AssessmentBuilder.tsx` (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Tài liệu này đặc tả yêu cầu cho **P0 — Smart Assessment Builder**, bổ sung hai chế độ tạo đề thông minh (**Blueprint** và **Pool**) vào tính năng Candidate Assessment của CertGym Enterprise. Thay vì chọn tay từng câu hỏi (MANUAL), Admin org có thể khai báo cấu hình và hệ thống tự động lấy câu hỏi từ ngân hàng câu hỏi riêng của org.

### 1.2. Phạm vi

**Trong phạm vi:**
- Thêm enum `AssessmentSelectionMode`: MANUAL / BLUEPRINT / POOL.
- Chế độ BLUEPRINT: tự build danh sách câu hỏi cố định theo % domain tại thời điểm tạo đề.
- Chế độ POOL: mỗi ứng viên nhận bộ câu ngẫu nhiên khác nhau khi bắt đầu; snapshot để reload bất biến.
- API preview đếm số câu khả dụng cho pool filter.
- Validation chặn tạo đề khi không đủ câu.
- Frontend: UI chọn 3 chế độ trong AssessmentBuilder.

**Ngoài phạm vi:**
- Blueprint theo ma trận domain × difficulty (để dành P3 của Smart Exam Builder cộng đồng).
- Sinh câu hỏi mới bằng AI.
- Chế độ MANUAL (đã có từ trước P0).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| **MANUAL** | Chế độ cũ — Admin chọn câu hỏi cụ thể, lưu thành `AssessmentQuestion` rows |
| **BLUEPRINT** | Build 1 bộ câu cố định tại thời điểm tạo assessment theo % domain từ `OrgQuestion` APPROVED |
| **POOL** | Không vật chất hóa trước; rút ngẫu nhiên N câu cho từng ứng viên khi họ bắt đầu |
| **selectionConfig** | JSON config mô tả blueprint/pool (totalQuestions, domains, drawCount, v.v.) |
| **drawnQuestionIds** | Snapshot IDs đã rút cho một `CandidateInvite` cụ thể (POOL mode, idempotent) |
| **pool-count** | Số câu `OrgQuestion` APPROVED khớp filter config của pool |

### 1.4. Hiện trạng trước P0

- `Assessment.questions` là mảng `AssessmentQuestion` — Admin tick tay từng câu.
- Không kiểm soát domain/difficulty distribution.
- Mỗi ứng viên nhận cùng bộ câu (chỉ random thứ tự nếu bật).

---

## 2. Mô tả tổng quan

### 2.1. Bối cảnh sản phẩm

P0 tận dụng logic blueprint đã có trong Smart Exam Builder cộng đồng (PR #69/#70) và tái sử dụng `OrgQuestion` APPROVED. BLUEPRINT phù hợp khi muốn đảm bảo tỉ lệ domain cố định (ví dụ: AWS exam có 35% Security, 30% Compute). POOL phù hợp khi cần ngăn chia sẻ đề giữa các ứng viên.

### 2.2. Nguyên tắc thiết kế

- MANUAL/BLUEPRINT: vật chất hóa qua `AssessmentQuestion` (có thể xem/sửa danh sách).
- POOL: không vật chất hóa; `CandidateInvite.drawnQuestionIds` là snapshot idempotent (lần đầu rút, các lần sau load lại).
- `selectionMode` **không thể thay đổi** sau khi assessment được tạo (tránh inconsistency với invites đã có).
- Nguồn câu hỏi: chỉ dùng `OrgQuestion` với `status = APPROVED` của org đó.

---

## 3. Yêu cầu chức năng

### FR-1 — Ba chế độ tạo đề

**FR-1.1**: `Assessment` có field `selectionMode: AssessmentSelectionMode` (default: `MANUAL`) và `selectionConfig: Json?`.

**FR-1.2**: Khi tạo assessment:
- `MANUAL` → payload chứa danh sách `questionIds` → backend ghi `AssessmentQuestion` rows (hành vi cũ).
- `BLUEPRINT` → payload chứa `selectionConfig` với danh sách domain + % → backend tự rút câu và ghi `AssessmentQuestion` rows.
- `POOL` → payload chứa `selectionConfig` với `drawCount` + filter → backend validate đủ câu, ghi `selectionConfig`, **không ghi** `AssessmentQuestion`.

**FR-1.3**: `selectionMode` không được đổi sau khi tạo (`PATCH` nhận `selectionMode` → `400 Bad Request`).

**FR-1.4**: Khi `PATCH` (sửa assessment):
- `MANUAL` → có thể cập nhật `questionIds`.
- `BLUEPRINT` → có thể cập nhật `selectionConfig` → backend rebuild `AssessmentQuestion` (xóa cũ, tạo mới).
- `POOL` → có thể cập nhật `selectionConfig` → validate lại đủ câu.

---

### FR-2 — BLUEPRINT: build câu theo domain %

**FR-2.1**: `selectionConfig` cho BLUEPRINT:

```jsonc
{
  "totalQuestions": 30,
  "domains": [
    { "domain": "Security", "percentage": 40 },
    { "domain": "Compute",  "percentage": 35 },
    { "domain": "Storage",  "percentage": 25 }
  ],
  "difficulty": "MEDIUM"   // optional — filter thêm theo difficulty
}
```

**FR-2.2**: Backend tính số câu mỗi domain: `Math.round(total × pct/100)`. Dư/thiếu do làm tròn → dồn vào domain có % lớn nhất.

**FR-2.3**: Với mỗi domain, query ngẫu nhiên đúng số câu `OrgQuestion` có `status=APPROVED`, `category` khớp domain (và `difficulty` nếu có). Shuffle và chọn.

**FR-2.4**: Nếu bất kỳ domain nào không đủ câu → `400 Bad Request` với thông báo rõ domain thiếu, số cần, số có.

**FR-2.5**: Ghi kết quả vào `AssessmentQuestion` (cùng cấu trúc với MANUAL).

---

### FR-3 — POOL: rút ngẫu nhiên per-candidate

**FR-3.1**: `selectionConfig` cho POOL:

```jsonc
{
  "drawCount": 15,
  "certificationId": "uuid",   // optional filter
  "difficulty": "HARD",        // optional filter
  "categories": ["Security"],  // optional filter
  "tags": ["aws", "iam"]       // optional filter
}
```

**FR-3.2**: Khi tạo assessment POOL → backend validate `available >= drawCount` (gọi `countPoolQuestions`). Nếu không đủ → `400 Bad Request`.

**FR-3.3**: `questionCount` của assessment được set = `drawCount` (để UI hiển thị "X câu").

**FR-3.4**: Khi ứng viên gọi `POST /take/:token/start`:
- Lần đầu: rút ngẫu nhiên `drawCount` câu từ pool, lưu IDs vào `CandidateInvite.drawnQuestionIds`.
- Lần sau (reload): load theo `drawnQuestionIds` — **cùng bộ câu**.

**FR-3.5**: Hai ứng viên khác nhau của cùng assessment POOL nhận bộ câu khác nhau (xác suất cao với pool đủ lớn).

---

### FR-4 — Preview pool count

**Endpoint**: `GET /organizations/:orgId/assessments/pool-count?config=<JSON>`

- `config` là URL-encoded JSON của pool filter (drawCount, certificationId, difficulty, categories, tags).
- Response: `{ available: number }`.
- Guard: `JwtAuthGuard + OrgRoleGuard(OWNER, ADMIN, MANAGER, RECRUITER)`.
- Dùng bởi frontend để hiển thị "X câu khả dụng" realtime khi Admin cấu hình pool.

---

### FR-5 — Validation lỗi thiếu câu

**FR-5.1**: `400 Bad Request` với body:

```jsonc
{
  "message": "Not enough approved questions for blueprint: domain 'Security' needs 12, found 8",
  "error": "Bad Request",
  "statusCode": 400
}
```

**FR-5.2**: Frontend disable nút "Tạo Assessment" nếu:
- BLUEPRINT: tổng % ≠ 100%.
- POOL: `poolAvailable < drawCount` hoặc `poolAvailable === null`.

---

### FR-6 — Frontend: 3-mode selector trong AssessmentBuilder

**FR-6.1**: UI hiển thị 3 tab/card chọn chế độ: **Manual**, **Blueprint**, **Pool**.

**FR-6.2**: Chọn BLUEPRINT → hiển thị `BlueprintDomainEditor`: mỗi domain một dòng với input % (tổng phải = 100%).

**FR-6.3**: Chọn POOL → hiển thị các filter (drawCount, difficulty, categories) + badge "X câu khả dụng" (gọi `pool-count` debounced).

**FR-6.4**: Khi edit assessment đã tạo → mode selector disabled (không cho đổi mode); hiển thị mode hiện tại read-only.

---

## 4. Yêu cầu phi chức năng

| ID | Yêu cầu |
|---|---|
| NFR-1 (Hiệu năng) | `buildBlueprintQuestions` và `countPoolQuestions` < 500ms với 10k OrgQuestion. Index cần: `(orgId, status, category, difficulty)` trên `org_questions`. |
| NFR-2 (Idempotency) | `drawnQuestionIds` snapshot bất biến — reload không thay đổi bộ câu của ứng viên. |
| NFR-3 (Backward compat) | MANUAL behavior không thay đổi; assessment cũ không có `selectionMode` → mặc định MANUAL. |
| NFR-4 (Atomic blueprint build) | Build + ghi `AssessmentQuestion` trong Prisma `$transaction` để tránh partial state. |

---

## 5. Schema Prisma

```prisma
enum AssessmentSelectionMode {
  MANUAL
  BLUEPRINT
  POOL
}

model Assessment {
  // ... existing fields ...
  selectionMode   AssessmentSelectionMode @default(MANUAL) @map("selection_mode")
  selectionConfig Json?                   @map("selection_config")
}

model CandidateInvite {
  // ... existing fields ...
  drawnQuestionIds String[] @default([]) @map("drawn_question_ids")
}
```

---

## 6. Acceptance Criteria

- [ ] Tạo assessment BLUEPRINT 30 câu (Security 40%, Compute 35%, Storage 25%) → `AssessmentQuestion` có đúng 12/11/7 câu (làm tròn dồn domain lớn nhất).
- [ ] Tạo assessment POOL drawCount=15 → 2 ứng viên start → 2 bộ câu khác nhau; cùng token reload → cùng bộ câu.
- [ ] POOL config vượt số câu khả dụng → `400` khi tạo.
- [ ] `GET pool-count` trả đúng số câu APPROVED khớp filter.
- [ ] PATCH đổi `selectionMode` → `400`.
- [ ] MANUAL assessment vẫn hoạt động đúng (regression).

---

## 7. Liên kết

- **Kế hoạch tổng**: [enterprise-entrance-exam-plan.md](../enterprise-entrance-exam-plan.md)
- **Schema**: [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma)
- **Service**: [backend/src/assessments/assessments.service.ts](../../backend/src/assessments/assessments.service.ts)
- **Candidate service**: [backend/src/assessments/candidate.service.ts](../../backend/src/assessments/candidate.service.ts)
- **Frontend builder**: [src/pages/org/AssessmentBuilder.tsx](../../src/pages/org/AssessmentBuilder.tsx)
