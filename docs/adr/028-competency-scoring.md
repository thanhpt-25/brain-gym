# ADR 003 — Competency Scoring Algorithm (S0-2 / FR-2)

**Status:** Proposed
**Date:** 2026-06-14
**Deciders:** ThanhPT (Architect)
**Liên quan:** [Sprint 0 — Foundation Basic Design](../specs/sprint-0-foundation-basic-design.md) §5

> ⚠️ **Lưu ý số hiệu:** số `003` hiện đã thuộc về `003-pass-predictor-v0.md` trong `00-index.md`.
> Tên file này theo yêu cầu enabler S0-2; **cần đổi số (vd 028) trước khi merge** để tránh trùng. Xem Consequences.

---

## Context

Sáng kiến Enterprise Organization cần suy ra **mức năng lực (competency level, thang 1–5)** của một người (nhân viên hoặc ứng viên) cho mỗi competency mà org định nghĩa. Dữ liệu điểm số sau mỗi bài đánh giá **đã được tổng hợp sẵn theo tên domain** dưới dạng JSON:

- `CandidateInvite.domainScores` và `ExamAttempt.domainScores` có shape
  `Record<string, { correct: number; total: number }>`, key là **tên domain/category** (string).
- Được tính tại thời điểm nộp bài — xem `candidate.service.ts submitAttempt` (L197–223) và
  `org-analytics.service.ts getSkillGaps` (L179). Không có bảng "raw answer per competency" sẵn dùng cho chấm điểm năng lực.
- Model `CompetencyDomain` (FR-1) ánh xạ một competency tới **nhiều tên domain** (so khớp case-insensitive).
- Model `QuestionCompetency` (FR-1) ánh xạ competency tới từng câu hỏi org, có `weight` — nhưng chưa được dùng ở đâu.

Có **hai phương án** để tính điểm năng lực:

- **Phương án A — recompute từ raw answers theo từng câu hỏi qua `QuestionCompetency`.**
  Với mỗi competency, lấy tập câu hỏi liên kết (qua `weight`), truy ngược các bản ghi answer của người đó, tính tỷ lệ đúng có trọng số. **Chính xác hơn** (chấm đúng theo câu hỏi thuộc competency, không phụ thuộc cách gom domain), nhưng đòi hỏi:
  - re-fetch raw answers (`Answer` / answer records của `CandidateInvite`) — thêm I/O, thêm join;
  - dữ liệu `QuestionCompetency` phải được điền đầy đủ (hiện chưa có UI/seed nào điền) → v0 sẽ không có gì để tính.

- **Phương án B — aggregate `domainScores` đã lưu qua mapping `CompetencyDomain`.**
  Với mỗi competency, lấy danh sách `CompetencyDomain.domainName`, cộng dồn `correct`/`total` của các domain khớp (case-insensitive) trong `domainScores`, ra tỷ lệ phần trăm → bucket thành level. **Tái dùng dữ liệu đã có**, không re-fetch raw answers, chạy được ngay khi org chỉ cần map domain (việc nhẹ) thay vì gán từng câu hỏi.

---

## Decision

### Chọn **Phương án B cho v0.**

Lý do:

1. **Tái dùng dữ liệu đã lưu** — `domainScores` đã tồn tại trên mọi attempt/invite đã nộp; không cần re-fetch hay re-score raw answers. I/O tối thiểu, tính được cả trên dữ liệu lịch sử.
2. **Chi phí cấu hình thấp** — org chỉ cần map vài tên domain vào competency (`CompetencyDomain`), thay vì gán nhãn competency cho từng câu hỏi. Điều này khả thi ngay Sprint 0; phương án A sẽ "rỗng" vì `QuestionCompetency` chưa được điền.
3. **Giữ cửa cho độ chính xác sau này** — `QuestionCompetency` vẫn được tạo ở FR-1 và **giữ lại** cho v1: khi dữ liệu gán câu hỏi đủ dày, có thể nâng cấp sang phương án A (hoặc lai) mà không phá schema.

### Pure function `inferCompetencyLevel()`

Vị trí: `backend/src/competency/scoring/infer-competency-level.ts` — thuần, không I/O.

```ts
interface DomainScore {
  correct: number;
  total: number;
}
interface Threshold {
  minPercentage: number;
  level: number;
} // sắp xếp giảm dần theo minPercentage

interface InferCompetencyLevelOptions {
  scaleMin: number; // mặc định 1
  scaleMax: number; // mặc định 5
  thresholds: Threshold[]; // bảng ngưỡng (xem mặc định bên dưới)
  minSampleForHigh?: number; // mặc định 20
  minSampleForMedium?: number; // mặc định 8
}

interface CompetencyLevelResult {
  level: number; // trong [scaleMin, scaleMax]
  percentage: number; // 0..100, làm tròn 1 chữ số thập phân
  confidence: "LOW" | "MEDIUM" | "HIGH";
  sampleSize: number; // Σtotal trên các domain khớp
}

function inferCompetencyLevel(
  domainScores: Record<string, DomainScore>,
  mappedDomains: string[],
  options: InferCompetencyLevelOptions,
): CompetencyLevelResult;
```

**Thuật toán:**

1. Chuẩn hóa key: lập map `lowercaseTrim(domainName) → DomainScore` từ `domainScores`; chuẩn hóa `mappedDomains` tương tự (**case-insensitive matching**).
2. Cộng dồn `sumCorrect = Σcorrect`, `sumTotal = Σtotal` chỉ trên các domain **vừa được map vừa có mặt** trong `domainScores`.
3. **Edge — không có dữ liệu** (`sumTotal === 0`, do không domain nào khớp / `domainScores` rỗng / `mappedDomains` rỗng):
   trả `{ level: scaleMin, percentage: 0, confidence: 'LOW', sampleSize: 0 }`. Không chia cho 0.
4. `percentage = (sumCorrect / sumTotal) * 100`.
5. **Bucket level:** duyệt `thresholds` (giảm dần theo `minPercentage`), chọn `level` đầu tiên có `percentage >= minPercentage`; nếu không khớp ngưỡng nào → `scaleMin`. Clamp kết quả vào `[scaleMin, scaleMax]`.
6. **Confidence theo sample size** (`sumTotal`):
   - `HIGH` nếu `sumTotal >= minSampleForHigh` (mặc định 20),
   - `MEDIUM` nếu `sumTotal >= minSampleForMedium` (mặc định 8),
   - ngược lại `LOW`.
     Confidence **độc lập** với level — báo cho người dùng "level này đáng tin tới đâu" dựa trên số câu đã làm.

**Edge cases được xử lý tường minh:**

| Edge                                                                       | Hành vi                                                                     |
| :------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| Không domain nào khớp / `domainScores` rỗng                                | `level=scaleMin, percentage=0, confidence=LOW, sampleSize=0` (không chia 0) |
| **Partial overlap** (chỉ một phần `mappedDomains` có trong `domainScores`) | Chỉ cộng phần khớp; `sampleSize` phản ánh đúng cỡ mẫu thực                  |
| **Case-insensitive** ("Networking" vs "networking" vs " NETWORKING ")      | Khớp sau khi `lowercaseTrim`                                                |
| Domain có `total=0` lọt vào                                                | Cộng vào sumTotal không đổi → không ảnh hưởng; vẫn an toàn                  |
| `percentage` đúng ngưỡng (vd = 80)                                         | Dùng `>=` → rơi vào bucket cao hơn                                          |

### Bảng ngưỡng mặc định (thang 1–5)

| Level | Nhãn gợi ý | `minPercentage` (≥) | Khoảng % |
| :---- | :--------- | :------------------ | :------- |
| **5** | Expert     | 90                  | 90–100   |
| **4** | Proficient | 75                  | 75–89    |
| **3** | Competent  | 60                  | 60–74    |
| **2** | Developing | 40                  | 40–59    |
| **1** | Novice     | 0                   | 0–39     |

```ts
const DEFAULT_THRESHOLDS_1_5: Threshold[] = [
  { minPercentage: 90, level: 5 },
  { minPercentage: 75, level: 4 },
  { minPercentage: 60, level: 3 },
  { minPercentage: 40, level: 2 },
  { minPercentage: 0, level: 1 },
];
```

### Unit-test cases (đại diện)

```ts
const opts = { scaleMin: 1, scaleMax: 5, thresholds: DEFAULT_THRESHOLDS_1_5 };

// TC1 — happy path, gộp nhiều domain, sample đủ lớn → HIGH
// Networking 18/20 + Security 9/10 = 27/30 = 90.0% → level 5; sample 30 ≥ 20 → HIGH
inferCompetencyLevel(
  {
    Networking: { correct: 18, total: 20 },
    Security: { correct: 9, total: 10 },
    Storage: { correct: 1, total: 5 },
  },
  ["Networking", "Security"],
  opts,
); // => { level: 5, percentage: 90.0, confidence: 'HIGH', sampleSize: 30 }

// TC2 — không có dữ liệu (mapped domain không xuất hiện trong domainScores)
inferCompetencyLevel(
  { Compute: { correct: 4, total: 5 } },
  ["Networking"],
  opts,
); // => { level: 1, percentage: 0, confidence: 'LOW', sampleSize: 0 }

// TC3 — case-insensitive + partial overlap, sample nhỏ → LOW
// chỉ 'networking' khớp ('Databases' không có): 3/6 = 50.0% → level 2; sample 6 < 8 → LOW
inferCompetencyLevel(
  { networking: { correct: 3, total: 6 } },
  ["NETWORKING", "Databases"],
  opts,
); // => { level: 2, percentage: 50.0, confidence: 'LOW', sampleSize: 6 }

// TC4 — biên ngưỡng dùng '>=' và confidence MEDIUM
// 6/8 = 75.0% đúng ngưỡng level 4; sample 8 ≥ 8 → MEDIUM
inferCompetencyLevel(
  { Security: { correct: 6, total: 8 } },
  ["security"],
  opts,
); // => { level: 4, percentage: 75.0, confidence: 'MEDIUM', sampleSize: 8 }
```

---

## Consequences

### Positive

- **Chạy được ngay trên dữ liệu hiện có** — tái dùng `domainScores` đã lưu, không cần backfill, không re-fetch raw answers; tính được cả cho attempt lịch sử.
- **Pure function, dễ test** — tách hoàn toàn khỏi Prisma/HTTP; toàn bộ nhánh (no-data, partial overlap, case-insensitive, biên ngưỡng, các mức confidence) phủ được bằng unit test, không cần DB.
- **Cấu hình nhẹ cho org** — chỉ cần map tên domain vào competency là có điểm; không bắt buộc gán nhãn từng câu hỏi.
- **Không khóa tương lai** — `QuestionCompetency` vẫn tồn tại; có thể nâng lên phương án A (chấm theo câu hỏi có trọng số) ở v1 mà không phá schema hay đổi chữ ký public (chỉ thay phần chuẩn bị input ở service layer).
- **Confidence tách khỏi level** — người dùng biết một level "4" dựa trên 6 câu là kém tin hơn dựa trên 40 câu, tránh quyết định tuyển dụng/đánh giá trên mẫu quá nhỏ.

### Risks / mitigations

- **Lệ thuộc chất lượng mapping domain** — nếu org map sai/thiếu tên domain, điểm sẽ lệch hoặc rỗng. _Mitigation:_ trả `confidence: LOW` + `sampleSize` rõ ràng để lộ "thiếu dữ liệu"; UI cảnh báo khi `sampleSize` thấp; validate domain tồn tại khi map.
- **`domainScores` aggregate, không weighted theo câu hỏi** — mọi domain trong competency được cộng "bình đẳng" theo số câu, không theo `weight`. _Mitigation:_ chấp nhận ở v0 (đủ tốt cho sàng lọc); v1 chuyển phương án A nếu cần độ chính xác.
- **Ngưỡng mặc định chỉ đúng cho thang 1–5** — org đặt `scaleMin/scaleMax` khác sẽ cần bảng ngưỡng riêng. _Mitigation:_ `thresholds` là tham số đầu vào (không hardcode); v0 chỉ ship bảng 1–5 và **giới hạn org dùng thang 1–5** cho tới khi có cơ chế ngưỡng tổng quát (ghi nhận open question §11.5 của basic design).
- **Tie-break / ranking hiring** — level rời rạc (1–5) gây nhiều ứng viên cùng level. _Mitigation:_ khi xếp hạng, dùng `percentage` (liên tục) làm tie-break thứ cấp, không chỉ `level`.
- **Trùng số ADR** — `003` đã dùng cho pass-predictor. _Mitigation:_ đổi số file (vd `028-competency-scoring.md`) và cập nhật `docs/adr/00-index.md` trước khi merge; nội dung quyết định không đổi.
- **Schema-only ở Sprint 0** — pure function + test được giao, nhưng endpoint chấm điểm thật chưa nối. _Mitigation:_ service layer kết nối ở sprint sau; Sprint 0 chỉ cam kết hàm thuần đã test.

```

```
