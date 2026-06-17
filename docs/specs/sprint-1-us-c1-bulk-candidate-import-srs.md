# SRS — US-C1: Nhập ứng viên hàng loạt (CSV / dán danh sách)

| | |
|---|---|
| **Tài liệu** | Software Requirements Specification (SRS) |
| **Tính năng** | US-C1 — Bulk Candidate Import |
| **Issue** | #102 |
| **Epic** | C — Thu hút & nhập ứng viên |
| **Phiên bản** | Draft 1.0 |
| **Ngày** | 2026-06-17 |
| **Trạng thái** | Draft — chờ implement |
| **Phụ thuộc** | Sprint 0 (Assessment, CandidateInvite, inviteCandidates đã có) |
| **Module liên quan** | `assessments` (backend) · `AssessmentResults.tsx` hoặc modal invite (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-C1**, cho phép Recruiter upload file CSV hoặc dán danh sách email/tên để mời hàng loạt ứng viên thay vì gõ tay từng người, với preview hàng lỗi trước khi gửi và báo cáo kết quả sau.

### 1.2. Phạm vi

**Trong phạm vi:**
- Parse CSV server-side bằng `parseCandidateCsv()` đã có.
- Dedupe với invite đã tồn tại trong cùng assessment (DB check).
- Preview hàng lỗi trước khi confirm gửi.
- Báo cáo: số mời thành công, số bỏ qua (trùng/lỗi).
- FE: dialog 2 tab (upload file / paste text), preview bảng, confirm.
- RBAC: OWNER, ADMIN, MANAGER, RECRUITER.

**Ngoài phạm vi:**
- Import từ Excel (.xlsx).
- Re-invite ứng viên đã có invite (update invite cũ).
- Import từ ATS bên ngoài.
- Gửi email hàng loạt async queue (email vẫn gửi đồng bộ như hiện tại).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| **parseCandidateCsv** | Hàm đã có trong `common/csv/parse-candidate-csv.ts` — parse + validate email + dedupe in-batch |
| **Dedupe DB** | Kiểm tra email đã tồn tại trong `CandidateInvite` của cùng assessment → skip |
| **invalidRows** | Hàng CSV có lỗi format hoặc email không hợp lệ |
| **skippedEmails** | Email hợp lệ nhưng đã được mời trong assessment này |

### 1.4. Hiện trạng trước US-C1

- `parseCandidateCsv(input: string)` — có test đầy đủ, xử lý: header `email`+`name`, validate RFC5322, dedupe in-batch (seen Set), sanitize formula injection, MAX_ROWS=1000.
- `inviteCandidates(slugOrId, assessmentId, dto)` — nhận `dto.candidates:[{email,name?}]`, tạo invite, gửi mail. **Không dedupe với DB** — gọi lại email cũ sẽ tạo invite trùng.
- Chưa có endpoint bulk-CSV. Chưa có FE dialog bulk import.

---

## 2. Yêu cầu chức năng

### FR-1 — Endpoint: Bulk import CSV

#### `POST /organizations/:orgId/assessments/:aid/candidates/bulk-csv`

**RBAC:** OWNER, ADMIN, MANAGER, RECRUITER.

**Content-Type:** `application/json`

Request body:
```json
{
  "csv": "email,name\nalice@example.com,Alice\nbob@example.com,Bob"
}
```

**Xử lý server-side:**
```
1. Validate: assessment thuộc orgId, status = ACTIVE.
2. parseCandidateCsv(dto.csv) → { valid, invalid, duplicatesRemoved }.
3. Nếu valid.length = 0 → 400 { message: "No valid candidates in CSV" }.
4. DB dedupe: query CandidateInvite WHERE assessmentId=aid AND candidateEmail IN valid.map(e=>e.email).
5. Tách: toInvite (chưa có invite) vs skipped (đã có invite, status != EXPIRED).
6. Gọi inviteCandidates logic (tạo invite + gửi mail) cho toInvite.
7. Trả về report.
```

Response `201`:
```json
{
  "invited": 45,
  "skipped": 3,
  "invalidRows": [
    { "row": 3, "raw": "notanemail,Test", "reason": "Invalid email: \"notanemail\"" }
  ],
  "skippedEmails": ["already@example.com"]
}
```

**Lỗi:**
- `400` nếu assessment không ACTIVE.
- `400` nếu CSV hoàn toàn rỗng / thiếu header email.
- `404` nếu assessment không tồn tại trong org.
- `413` nếu `csv` string > 2MB.

---

### FR-2 — Dedupe logic chi tiết

**Query dedupe:**
```sql
SELECT candidate_email FROM candidate_invites
WHERE assessment_id = :aid
  AND candidate_email IN (:emails)
  AND status != 'EXPIRED'
```

**Ý nghĩa:** Invite EXPIRED được coi là không còn hiệu lực — cho phép re-invite cùng email sau khi link hết hạn.

**Trả về `skippedEmails`:** Danh sách email bị skip do đã có invite active/completed.

---

### FR-3 — FE: Dialog bulk import

**Trigger:** Nút "Import CSV" trong trang quản lý invite của assessment.

**Bước 1 — Nhập dữ liệu:**

Dialog với 2 tab:
- **Tab "Upload file"**: input `<input type="file" accept=".csv">`, đọc file → đưa vào textarea preview.
- **Tab "Dán danh sách"**: textarea lớn, placeholder `email,name\nalice@example.com,Alice`.

**Bước 2 — Preview (sau khi parse client-side tạm):**

Sau khi user nhập xong, FE parse preview (không cần gọi API):
- Bảng valid: email, name (có thể sửa trước khi submit).
- Bảng lỗi (nếu có): row số, nội dung, lý do.
- Summary: "X email hợp lệ · Y hàng lỗi (bị bỏ qua) · Z trùng trong file".

Nút "Xác nhận gửi (X người)" → gọi FR-1.

**Bước 3 — Kết quả:**

Toast:
- Thành công: "Đã mời 45 ứng viên".
- Bỏ qua: "3 email đã được mời trước (bỏ qua)".
- Lỗi format: link expand "Xem X hàng lỗi" → expandable list.

---

### FR-4 — Validation phía FE

- File: chỉ chấp nhận `.csv`, tối đa 5MB client-side.
- Preview parse: dùng logic đơn giản (split `\n` + `,`) — không cần import parser library.
- Disable nút submit nếu `valid.length = 0`.

---

## 3. Yêu cầu phi chức năng

| NFR | Mô tả |
|---|---|
| **Atomicity** | Dùng `prisma.$transaction` cho bulk insert (hoặc `createMany`) |
| **MAX_ROWS** | 1000 rows per request (enforce trong `parseCandidateCsv`) |
| **Idempotency** | Gọi lại cùng CSV → chỉ invite những email chưa có; không tạo trùng |
| **Mail** | Gửi email cho từng invite mới (giữ behavior hiện tại của `inviteCandidates`) |
| **Không schema mới** | Dùng `CandidateInvite` hiện có; không cần migration |

---

## 4. API Contract

| Method | Path | RBAC | Mô tả |
|---|---|---|---|
| POST | `/organizations/:orgId/assessments/:aid/candidates/bulk-csv` | OWNER,ADMIN,MANAGER,RECRUITER | Bulk import từ CSV |

---

## 5. UI States

```
idle
  → user upload/paste → preview
    → confirm (loading)
      → success: toast + refresh invite list
      → partial: toast với detail + refresh
      → error: toast lỗi (assessment không ACTIVE, CSV rỗng...)
```

---

## 6. Test Cases

| # | Tình huống | Kết quả |
|---|---|---|
| T1 | CSV hợp lệ 10 email, 0 trùng | 201, invited=10, skipped=0 |
| T2 | 3 email trùng trong DB | 201, invited=7, skipped=3, skippedEmails=[...] |
| T3 | Tất cả email đã có invite | 201, invited=0, skipped=N |
| T4 | CSV thiếu header email | 400 |
| T5 | CSV rỗng hoàn toàn | 400 |
| T6 | Assessment status=DRAFT | 400 |
| T7 | MEMBER thử bulk import | 403 |
| T8 | Gọi 2 lần cùng CSV | Lần 2: invited=0, skipped=N (idempotent) |
| T9 | Email EXPIRED invite → gửi lại | invited++ (EXPIRED không bị skip) |
| T10 | 1001 rows | 400 (vượt MAX_ROWS) |

---

## 7. Thứ tự implement

1. DTO `BulkCsvInviteDto` (`{ csv: string }`).
2. `bulkCsvInvite(orgId, assessmentId, dto)` trong `assessments.service.ts` — gọi `parseCandidateCsv()`, dedupe DB, bulk create.
3. Route `POST .../candidates/bulk-csv` trong `assessments.controller.ts`.
4. FE dialog component (tab upload + paste, preview, confirm).
5. FE service function.
6. Tests.

---

## 8. Open Questions

- Có nên tách `bulkCsvInvite` thành service riêng trong `candidate.service.ts` không? (Đề xuất: để trong `assessments.service.ts` vì gần logic `inviteCandidates` hiện tại.)
- Giới hạn rate limit bulk import không? (Đề xuất: 5 requests/minute per orgId.)
