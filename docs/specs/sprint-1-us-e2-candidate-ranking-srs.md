# SRS — US-E2: Bảng so sánh & xếp hạng ứng viên

| | |
|---|---|
| **Tài liệu** | Software Requirements Specification (SRS) |
| **Tính năng** | US-E2 — Candidate Comparison & Ranking Board |
| **Issue** | #109 |
| **Epic** | E — Tự động sàng lọc & xếp hạng |
| **Phiên bản** | Draft 1.0 |
| **Ngày** | 2026-06-17 |
| **Trạng thái** | Draft — chờ implement |
| **Phụ thuộc** | Sprint 0 (getResults, exportCsv đã có); không phụ thuộc US-A1/A2/A3 |
| **Module liên quan** | `assessments.service.ts` (backend delta nhỏ) · `AssessmentResults.tsx` (frontend mở rộng lớn) |

---

## 1. Giới thiệu

### 1.1. Mục đích

Đặc tả yêu cầu cho **US-E2**, cung cấp bảng xếp hạng đầy đủ (leaderboard) cho Recruiter/Hiring Manager: so sánh ứng viên cạnh nhau theo nhiều tiêu chí (điểm, percentile, domain breakdown, integrity, thời gian), với sort/filter đa chiều và xuất shortlist.

### 1.2. Phạm vi

**Trong phạm vi:**
- Bảng leaderboard với tất cả cột: rank, tên/email, điểm, percentile, stage, domain scores, integrity, time.
- Sort client-side đa tiêu chí (click header).
- Filter panel: theo stage, passed/failed, min score, min rating.
- Domain scores breakdown (expandable row / tooltip).
- Integrity badge với màu sắc và tooltip.
- Xuất shortlist CSV (filter `shortlisted` hoặc `passed`).
- BE: thêm query param `filter` vào `exportCsv`.

**Ngoài phạm vi:**
- AI screening / auto-reject.
- Email thông báo shortlist.
- So sánh giữa nhiều assessment.
- Competency profile từ US-A3 (tách biệt).

### 1.3. Định nghĩa thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| **percentile** | Xếp hạng điểm trong cùng assessment (0–100); đã tính trong `getResults()` |
| **integrityScore** | Điểm toàn vẹn (0–100): kết hợp tab switches, IP, thời gian; đã có trong DB |
| **domainScores** | Json `{domainName: {correct, total}}` từ ExamAttempt/CandidateInvite |
| **shortlist** | Ứng viên có `stage = SHORTLISTED` |
| **passed** | Ứng viên có `score >= assessment.passingScore` |

### 1.4. Hiện trạng trước US-E2

- `getResults()` trả về đầy đủ data: `percentile`, `score`, `domainScores`, `integrityScore`, `tabSwitchCount`, `timeSpent`, `stage`, `rating`, `recruiterNote`.
- `exportCsv()` xuất tất cả candidate, không có filter.
- `AssessmentResults.tsx` (262 dòng): bảng cơ bản, **không có sort, filter, percentile display, domainScores, integrity**.

---

## 2. Yêu cầu chức năng

### FR-1 — Bảng leaderboard

**Columns (theo thứ tự hiển thị):**

| Column | Nguồn data | Sortable |
|---|---|---|
| # Rank | Tính từ sort hiện tại | — |
| Tên / Email | `candidateName`, `candidateEmail` | Tên ASC/DESC |
| Điểm (%) | `score` | ✓ |
| Percentile | `percentile` | ✓ |
| Stage | `stage` (badge màu) | ✓ |
| Domains | `domainScores` (expandable) | — |
| Integrity | `integrityScore` (badge) | ✓ |
| Thời gian | `timeSpent` (giây → mm:ss) | ✓ |
| Rating | `rating` (sao 1–5) | ✓ |
| Nộp lúc | `submittedAt` | ✓ |
| Hành động | Nút xem chi tiết / đổi stage | — |

Chỉ hiển thị candidate có `status = SUBMITTED`. Candidate INVITED/STARTED hiển thị riêng ở summary funnel phía trên.

---

### FR-2 — Sort client-side

- Click header column → sort ASC; click lại → DESC; click lần 3 → reset (về score DESC default).
- Hiển thị icon ↑/↓ trên header đang sort.
- Sort state lưu trong local React state (không đồng bộ URL).
- Multi-sort không cần thiết (single sort là đủ).

---

### FR-3 — Filter panel

**Filter controls:**

| Filter | UI | Logic |
|---|---|---|
| Stage | Multi-select (APPLIED, SCREENING, SHORTLISTED, HIRED, REJECTED) | `candidate.stage IN selectedStages` |
| Kết quả | Radio: Tất cả / Đạt / Trượt | `score >= passingScore` hoặc `< passingScore` |
| Điểm tối thiểu | Slider 0–100 | `score >= minScore` |
| Rating tối thiểu | Select 1–5 sao / Tất cả | `rating >= minRating` |

Filter áp dụng client-side trên data đã load từ `getResults()`.

Nút "Xóa filter" reset tất cả về default.

---

### FR-4 — Domain scores breakdown

**Hiển thị:** Expandable row hoặc hover popover.

**Nội dung:**
```
Domain: Networking    ████████░░  80% (20/25)
Domain: Security      █████░░░░░  50% (10/20)  ← đỏ vì < 60%
Domain: Storage       ███████░░░  70% (14/20)
```

- Highlight đỏ nếu domain percentage < 60%.
- Sort domain theo % tăng dần (domain yếu nhất lên đầu).

---

### FR-5 — Integrity badge

| integrityScore | Badge | Màu |
|---|---|---|
| ≥ 80 | Tốt | Xanh lá |
| 60–79 | Trung bình | Vàng cam |
| < 60 | Cần xem xét | Đỏ |
| null | — | Xám (N/A) |

**Tooltip:** "Tab switch: {tabSwitchCount} lần · IP: {ipAddress} · Score: {integrityScore}/100"

---

### FR-6 — Xuất shortlist CSV

**Nút:** "Xuất shortlist ({N})" — chỉ enable khi có ≥1 candidate shortlisted.

**Gọi:** `GET /organizations/:orgId/assessments/:aid/export-csv?filter=shortlisted`

**File:** `shortlist-{assessmentTitle}-{date}.csv`

Ngoài ra giữ nút "Xuất tất cả" → `?filter=all` (behavior hiện tại).

---

### FR-7 — BE: Thêm query param `filter` vào exportCsv

#### `GET /organizations/:orgId/assessments/:aid/export-csv?filter=all|submitted|passed|shortlisted`

**Default:** `filter=all` (behavior hiện tại không thay đổi).

**Logic filter:**
- `all`: tất cả candidates.
- `submitted`: chỉ `status=SUBMITTED`.
- `passed`: `status=SUBMITTED AND score >= assessment.passingScore`.
- `shortlisted`: `stage=SHORTLISTED`.

Đảm bảo backward-compatible: không truyền `filter` → `all`.

---

## 3. Yêu cầu phi chức năng

| NFR | Mô tả |
|---|---|
| **Client-side sort/filter** | Không gọi API mới khi sort/filter — dùng data đã load |
| **Performance** | ≤ 1000 candidates: client-side là đủ. >500: xem xét `react-virtual` nếu bảng lag |
| **Export** | File CSV tải về ngay, không cần polling |
| **Backward compat** | `exportCsv` không truyền `filter` → `all`, giữ nguyên behavior |
| **Responsive** | Bảng có horizontal scroll trên mobile; columns quan trọng (name, score, stage) pin left |

---

## 4. API Delta (chỉ thay đổi nhỏ ở BE)

| Method | Path | Thay đổi |
|---|---|---|
| GET | `/organizations/:orgId/assessments/:aid/export-csv` | Thêm query param `?filter` |

Không có endpoint mới. `getResults()` không thay đổi.

---

## 5. UI Layout (dạng text mockup)

```
[Assessment Title] — Results

Funnel: Total 120 | Started 98 | Submitted 85 | Passed 42

[Filter: Stage ▾] [Kết quả ▾] [Điểm ≥ __] [Rating ≥ __]  [Xóa filter]
                                              [Xuất shortlist (12)] [Xuất tất cả]

# | Tên/Email            | Điểm | %ile | Stage      | Domains | Integrity | Thời gian | Rating | Nộp lúc
1 | Nguyen Van A         | 92%  |  98  | SHORTLISTED|  [+]   |  🟢 95    | 45:20     | ★★★★☆  | ...
2 | Tran Thi B           | 88%  |  91  | SCREENING  |  [+]   |  🟡 72    | 52:10     | —      | ...
...

[row expanded]
  └─ Domain Networking: 95% ████████████
     Domain Security:   45% █████░░░░░░  ← đỏ
```

---

## 6. Test Cases

| # | Tình huống | Kết quả |
|---|---|---|
| T1 | Sort theo percentile DESC | Candidate percentile cao nhất lên đầu |
| T2 | Filter stage=SHORTLISTED | Chỉ hiện shortlisted |
| T3 | Filter passed với passingScore=70 | Chỉ hiện score ≥ 70 |
| T4 | Expand domain row | Domain breakdown hiển thị đúng % |
| T5 | integrityScore=55 | Badge đỏ "Cần xem xét" |
| T6 | Export shortlist | File CSV chỉ chứa stage=SHORTLISTED |
| T7 | Export passed | File chỉ chứa score ≥ passingScore |
| T8 | Không có candidate SUBMITTED | Bảng trống, funnel hiện 0 submitted |
| T9 | GET exportCsv không truyền filter | Trả tất cả (backward compat) |
| T10 | 0 candidate shortlisted | Nút "Xuất shortlist" disabled |

---

## 7. Thứ tự implement

1. **BE:** Thêm `filter` query param vào `exportCsv` trong `assessments.service.ts` và `assessments.controller.ts`.
2. **FE:** Mở rộng `AssessmentResults.tsx`:
   a. Thêm sort state + click handler trên headers.
   b. Thêm filter panel (Stage, Kết quả, Điểm, Rating).
   c. Thêm columns: Percentile, Integrity badge, Domain expandable.
   d. Nút "Xuất shortlist".
3. Tests BE (exportCsv filter) + FE (sort, filter, expand).

---

## 8. Open Questions

- Có cần lưu filter/sort vào URL (để share link) không? (Đề xuất: Sprint 2 nếu có nhu cầu.)
- `integrityScore` null (assessment không bật proctoring) → hiển thị "N/A" hay ẩn column? (Đề xuất: ẩn cột Integrity nếu tất cả null.)
