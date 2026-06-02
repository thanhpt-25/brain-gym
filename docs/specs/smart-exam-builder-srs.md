# SRS — Smart Exam Builder (Tạo & sửa exam theo cấu trúc)

| | |
|---|---|
| **Tài liệu** | Software Requirements Specification (SRS) |
| **Tính năng** | Smart Exam Builder — chế độ tạo đề "Theo cấu trúc" (Blueprint) |
| **Phiên bản** | 0.1 (Draft — để review) |
| **Ngày** | 2026-06-02 |
| **Trạng thái** | Đề án, chưa triển khai code |
| **Module liên quan** | `exams`, `questions` (backend) · `ExamBuilder.tsx` (frontend) |

---

## 1. Giới thiệu

### 1.1. Mục đích
Tài liệu này đặc tả yêu cầu cho tính năng **Smart Exam Builder**, bổ sung chế độ tạo đề thi **theo cấu trúc (blueprint)** vào CertGym. Thay vì tick thủ công từng câu, người tạo đề chỉ khai báo **hạn ngạch (quota)** theo độ khó và/hoặc tỉ lệ phần trăm domain; hệ thống tự động bốc câu hỏi phù hợp từ ngân hàng câu hỏi đã duyệt.

### 1.2. Phạm vi
- **Trong phạm vi:** Chế độ tạo đề thứ 3 ("Theo cấu trúc"), API thống kê ngân hàng câu hỏi, logic bốc câu theo quota, cảnh báo/chặn khi thiếu câu, mở rộng luồng edit.
- **Ngoài phạm vi:** Sinh câu hỏi mới bằng AI (đã có ở `AiQuestionGenerator.tsx`), kiểm duyệt câu hỏi, exam adaptive/scenario, đề của tổ chức (`/org`).

### 1.3. Định nghĩa thuật ngữ
| Thuật ngữ | Ý nghĩa |
|---|---|
| **Blueprint** | Bảng khai báo cấu trúc đề: số câu theo từng độ khó / domain / ô matrix |
| **Bucket (ô quota)** | Một nhóm tiêu chí cần bốc câu, vd "HARD × Security = 10 câu" |
| **Quota** | Số câu mục tiêu của một bucket |
| **Ngân hàng câu hỏi** | Tập câu hỏi `status = APPROVED` thuộc certification được chọn |
| **Re-roll** | Bốc lại bộ câu mới giữ nguyên blueprint |
| **Dry-run / Preview** | Bốc thử (không lưu) để xem trước bộ câu |

### 1.4. Hiện trạng (baseline)
Theo [ExamBuilder.tsx](../../src/pages/ExamBuilder.tsx) và [exams.service.ts](../../backend/src/exams/exams.service.ts):

- Có 2 chế độ: **Random** (nhập 1 số, backend `shuffle().slice(count)` toàn bộ câu APPROVED) và **Pick** (tick checkbox từng câu, phân trang 20/lần).
- Chế độ **Random** không kiểm soát được độ khó/domain → đề dễ bị lệch.
- Chế độ **Pick** không khả thi với ngân hàng lớn (200–500 câu).
- Luồng **edit** bị khoá cứng về mode "pick" → sửa đề lớn phải tick lại từ đầu.
- Dữ liệu sẵn có nhưng chưa dùng: `Question.difficulty` (EASY/MEDIUM/HARD) và `Question.domainId` ([schema.prisma:344-349](../../backend/prisma/schema.prisma)).

---

## 2. Mô tả tổng quan

### 2.1. Bối cảnh sản phẩm
Smart Exam Builder là một chế độ bổ sung **không thay thế** Random/Pick. Người dùng chọn 1 trong 3 chế độ khi tạo đề. Tính năng tái sử dụng toàn bộ hạ tầng exam hiện có (model `Exam`, `ExamQuestion`, luồng làm bài).

### 2.2. Các nhóm người dùng
| Vai trò | Nhu cầu |
|---|---|
| **Người tạo đề (community)** | Tạo nhanh một đề cân bằng mà không tick từng câu |
| **Power-user / instructor** | Mô phỏng đúng blueprint chính thức của hãng (AWS/Azure…) bằng tỉ lệ domain |
| **Người sửa đề** | Điều chỉnh cấu trúc đề đã có (vd thêm câu khó) mà không dựng lại từ đầu |

### 2.3. Giả định & ràng buộc
- Câu hỏi phải có `status = APPROVED` mới được bốc.
- `difficulty` luôn có giá trị (mặc định MEDIUM trong schema); `domainId` có thể NULL → cần xử lý nhóm "không có domain".
- Giữ nguyên ràng buộc hiện tại: certification **không đổi được** sau khi tạo đề.
- TypeScript loose (`strictNullChecks: false`) — tuân theo style sẵn có, không siết kiểu mới.

### 2.4. Quyết định đã chốt
1. **Đợt này chỉ làm tài liệu đề án/SRS, chưa code.**
2. **Khi ngân hàng thiếu câu cho một bucket → CHẶN, không tạo đề**, báo lỗi rõ từng bucket thiếu. Không có chế độ "lấp tạm". Đề luôn đúng 100% blueprint hoặc không tạo.

---

## 3. Yêu cầu chức năng

> Quy ước độ ưu tiên: **P1** = MVP (phải có) · **P2** = nên có · **P3** = nâng cao.

### FR-1 — Chọn chế độ tạo đề `[P1]`
- FR-1.1: Form tạo đề hiển thị 3 chế độ: **Random**, **Pick**, **Theo cấu trúc**.
- FR-1.2: Mặc định giữ nguyên hành vi cũ; chọn "Theo cấu trúc" sẽ hiện trình soạn blueprint.
- FR-1.3: Khi đổi certification, mọi quota/blueprint được reset.

### FR-2 — Thống kê ngân hàng câu hỏi `[P1]`
- FR-2.1: Hệ thống cung cấp số liệu phân bố câu APPROVED của certification: tổng, theo độ khó, theo domain, và (P3) theo ô matrix.
- FR-2.2: UI dùng số liệu này để hiển thị "có sẵn bao nhiêu câu" cạnh mỗi bucket, **realtime** khi người dùng chỉnh quota.

### FR-3 — Blueprint theo độ khó `[P1]`
- FR-3.1: Người dùng nhập tổng số câu, rồi phân bổ theo EASY/MEDIUM/HARD bằng **%** hoặc **số câu tuyệt đối**.
- FR-3.2: Khi nhập %, hệ thống tự quy đổi sang số câu (làm tròn), và **tự cân** để tổng các bucket khớp tổng số câu (chênh lệch do làm tròn dồn vào bucket lớn nhất).
- FR-3.3: Tổng % phải bằng 100% (hoặc tổng số câu các bucket = tổng đề) thì mới cho lưu.

### FR-4 — Blueprint theo tỉ lệ domain `[P2]`
- FR-4.1: Liệt kê các domain của certification, mỗi domain một dòng quota (% hoặc số câu).
- FR-4.2: Cùng cơ chế quy đổi/cân tổng như FR-3.
- FR-4.3: Hỗ trợ nhóm "Không gán domain" nếu certification có câu `domainId = NULL`.

### FR-5 — Blueprint matrix (domain × độ khó) `[P3]`
- FR-5.1: Bảng 2 chiều domain × {EASY,MEDIUM,HARD}, mỗi ô một quota.
- FR-5.2: Hiển thị tổng hàng/cột và tổng toàn bảng để người dùng đối chiếu.

### FR-6 — Bốc câu theo blueprint `[P1]`
- FR-6.1: Với mỗi bucket, hệ thống lấy ngẫu nhiên đủ số câu APPROVED khớp tiêu chí.
- FR-6.2: **Không trùng** câu giữa các bucket.
- FR-6.3: Thứ tự câu trong đề được trộn ngẫu nhiên (ghi vào `ExamQuestion.sortOrder`).
- FR-6.4: Hành vi bốc câu dùng chung cho cả **tạo mới** và **sửa**.

### FR-7 — Xử lý thiếu câu (CHẶN) `[P1]`
- FR-7.1: Trước khi lưu, hệ thống kiểm tra mọi bucket có đủ câu không.
- FR-7.2: Nếu bất kỳ bucket nào thiếu → **không tạo/không cập nhật đề**, trả lỗi `422` liệt kê từng bucket: `required`, `available`, `missing`.
- FR-7.3: UI chặn ở client trước (disable nút lưu, đánh dấu đỏ dòng thiếu) dựa trên số liệu FR-2; backend vẫn validate lại lần cuối làm nguồn chân lý.

### FR-8 — Xem trước (Preview / dry-run) `[P2]`
- FR-8.1: Người dùng bấm "Xem trước" để bốc thử (không lưu) và xem danh sách câu sẽ vào đề, kèm nhãn độ khó/domain.
- FR-8.2: Cho phép **đổi lẻ** một câu (swap) bằng câu khác cùng bucket trước khi lưu.
- FR-8.3: Cho phép **re-roll** toàn bộ để bốc lại bộ câu mới cùng blueprint.

### FR-9 — Lưu & re-roll blueprint `[P3]`
- FR-9.1: Blueprint được lưu kèm `Exam` để về sau có thể edit lại cấu trúc hoặc re-roll.
- FR-9.2: Chức năng "Nhân bản đề tương tự" tạo đề mới từ cùng blueprint với bộ câu mới.

### FR-10 — Sửa đề (edit) `[P2]`
- FR-10.1: Luồng edit cho phép cả 3 chế độ, không khoá cứng "pick".
- FR-10.2: Nếu đề được tạo bằng blueprint (FR-9), edit hiển thị lại blueprint đã lưu để chỉnh.
- FR-10.3: Lưu edit theo blueprint sẽ **thay toàn bộ** bộ câu (đồng nhất với hành vi update hiện tại) và cập nhật lại `questionCount`.

---

## 4. Yêu cầu phi chức năng

| ID | Yêu cầu |
|---|---|
| NFR-1 (Hiệu năng) | API thống kê & bốc câu phản hồi < 500ms với ngân hàng ~1.000 câu. Truy vấn theo `certificationId`, `status`, `difficulty`, `domainId` cần có index phù hợp. |
| NFR-2 (Tính nhất quán) | Backend là nguồn chân lý cuối cùng cho việc đủ/thiếu câu; tránh race khi câu đổi trạng thái giữa lúc người dùng đang soạn. |
| NFR-3 (Khả dụng) | Slider/quota cập nhật realtime; cảnh báo thiếu câu hiển thị tức thì, không cần submit. |
| NFR-4 (Tương thích) | Không phá vỡ Random/Pick hiện có; đề cũ vẫn chạy bình thường (blueprint là field tuỳ chọn). |
| NFR-5 (A11y) | Trình soạn blueprint điều khiển được bằng bàn phím, có nhãn ARIA cho slider/ô nhập, tuân theo baseline tại `docs/a11y-baseline.md`. |
| NFR-6 (i18n) | Chuỗi UI dùng cơ chế đa ngôn ngữ hiện hành của frontend. |

---

## 5. Thiết kế giao diện API (đề xuất)

> Hợp đồng chi tiết sẽ được chốt ở bước thiết kế; phần này định hướng.

### 5.1. `GET /questions/stats?certificationId=...` `[P1]`
```jsonc
{
  "total": 320,
  "byDifficulty": { "EASY": 90, "MEDIUM": 160, "HARD": 70 },
  "byDomain": [
    { "domainId": "d1", "name": "Design Secure Architectures", "count": 80 }
  ],
  "matrix": [                                  // P3
    { "domainId": "d1", "difficulty": "HARD", "count": 12 }
  ]
}
```

### 5.2. Mở rộng `CreateExamDto` / `UpdateExamDto` `[P1+]`
```ts
selectionStrategy?: 'MANUAL' | 'RANDOM' | 'BLUEPRINT';

blueprint?: {
  byDifficulty?: { EASY?: number; MEDIUM?: number; HARD?: number };   // số câu
  byDomain?: { domainId: string | null; count: number }[];           // P2
  matrix?: { domainId: string | null; difficulty: Difficulty; count: number }[]; // P3
};
```
- Hiện chỉ chấp nhận **một** trong `byDifficulty` / `byDomain` / `matrix` mỗi lần (không trộn) ở P1–P2; matrix là dạng tổng quát ở P3.

### 5.3. `POST /exams/preview` (dry-run) `[P2]`
- Nhận `certificationId` + `blueprint`, trả về danh sách câu được bốc **mà không lưu**, hoặc lỗi `422` nếu thiếu.

### 5.4. Lỗi thiếu câu (chuẩn `[P1]`)
```jsonc
// 422 Unprocessable Entity
{
  "error": "BLUEPRINT_INSUFFICIENT_QUESTIONS",
  "message": "Ngân hàng câu hỏi không đủ cho cấu trúc đã chọn",
  "shortages": [
    { "bucket": "HARD", "domainId": "d1", "required": 10, "available": 6, "missing": 4 }
  ]
}
```

---

## 6. Ảnh hưởng dữ liệu

- **P1–P2:** Không bắt buộc đổi schema — blueprint truyền qua DTO và chỉ dùng để bốc câu lúc tạo. Tận dụng `Question.difficulty`, `Question.domainId` sẵn có.
- **P3:** Thêm cột JSON tuỳ chọn `blueprint` vào model `Exam` (1 migration nhỏ) để hỗ trợ lưu/re-roll/nhân bản. Cần migration + cập nhật `02-data_model.md`.
- Rà soát index trên `Question(certificationId, status, difficulty, domainId)` phục vụ NFR-1.

---

## 7. Kế hoạch triển khai theo giai đoạn

| Phase | Nội dung | FR bao phủ |
|---|---|---|
| **P1 (MVP)** | `GET /questions/stats` + Blueprint theo độ khó + bốc câu + chặn-báo-lỗi thiếu câu | FR-1, FR-2, FR-3, FR-6, FR-7 |
| **P2** | Blueprint theo % domain + Preview/dry-run + swap lẻ + mở luồng edit | FR-4, FR-8, FR-10 |
| **P3** | Matrix domain×difficulty + lưu blueprint + re-roll + nhân bản đề | FR-5, FR-9 |

---

## 8. Tiêu chí chấp nhận (Acceptance Criteria — P1)

- **AC-1:** Tạo đề 50 câu với blueprint 30% EASY / 50% MEDIUM / 20% HARD → đề tạo ra có đúng 15/25/10 câu theo độ khó, không trùng câu.
- **AC-2:** Tổng % ≠ 100% → nút "Tạo đề" bị disable, có thông báo lý do.
- **AC-3:** Một bucket yêu cầu nhiều hơn số câu sẵn có → UI đánh dấu đỏ dòng đó, nút lưu disable; nếu gọi API trực tiếp vẫn trả `422` với `shortages` đúng.
- **AC-4:** Bốc câu cùng blueprint hai lần cho ra bộ câu (có thể) khác nhau nhưng luôn đúng quota (tính ngẫu nhiên có kiểm soát).
- **AC-5:** Random và Pick hoạt động y như trước, đề cũ mở/sửa/làm bài bình thường.

---

## 9. Rủi ro & vấn đề mở

| # | Rủi ro / câu hỏi | Hướng xử lý đề xuất |
|---|---|---|
| R-1 | Câu `domainId = NULL` làm lệch quota theo domain | Tạo nhóm "Không gán domain" tường minh (FR-4.3) |
| R-2 | Người dùng kỳ vọng trộn cả difficulty lẫn domain ở P2 | P2 chỉ chọn 1 chiều; trộn 2 chiều để dành matrix ở P3 |
| R-3 | Câu đổi trạng thái giữa lúc soạn → preview đúng nhưng lưu lại thiếu | Backend validate lại lúc lưu (NFR-2), trả 422 nếu cần |
| R-4 | Làm tròn % gây tổng lệch 1–2 câu | Quy tắc dồn phần dư vào bucket lớn nhất (FR-3.2) |
| R-5 | Có nên lưu blueprint từ P1 để phân tích về sau? | Hiện hoãn tới P3; cân nhắc nếu cần dữ liệu sớm |

---

*Tài liệu này ở trạng thái Draft để review. Sau khi chốt phạm vi và các vấn đề mở (mục 9), sẽ chuyển sang thiết kế chi tiết (hợp đồng API đầy đủ, wireframe) và lập kế hoạch sprint.*
