# Local LLM Question Generation

> **Feature:** US-XXXX — Sinh câu hỏi từ Local LLM (Ollama / LM Studio)
> **Version:** 1.0
> **Date:** 2026-05-31
> **Status:** Design — Awaiting Implementation
> **Author:** ThanhPT

---

## Table of Contents

1. [Tổng quan & Mục tiêu](#1-tổng-quan--mục-tiêu)
2. [Phân tích hiện trạng](#2-phân-tích-hiện-trạng)
3. [Kiến trúc giải pháp](#3-kiến-trúc-giải-pháp)
4. [Thiết kế kỹ thuật chi tiết](#4-thiết-kế-kỹ-thuật-chi-tiết)
   - 4.1 [LocalLlmDialect — lớp trừu tượng](#41-localllmdialect--lớp-trừu-tượng)
   - 4.2 [Model discovery](#42-model-discovery)
   - 4.3 [Sinh câu hỏi (generate)](#43-sinh-câu-hỏi-generate)
   - 4.4 [JSON validation & repair](#44-json-validation--repair)
   - 4.5 [Intake vào BrainGym](#45-intake-vào-braingym)
   - 4.6 [Lưu trữ cấu hình local](#46-lưu-trữ-cấu-hình-local)
   - 4.7 [UI — mở rộng LlmConfigPanel](#47-ui--mở-rộng-llmconfigpanel)
5. [Xử lý lỗi & UX](#5-xử-lý-lỗi--ux)
6. [Bảo mật](#6-bảo-mật)
7. [Backend — thay đổi tối thiểu](#7-backend--thay-đổi-tối-thiểu)
8. [Kế hoạch triển khai](#8-kế-hoạch-triển-khai)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [Rủi ro & Giảm thiểu](#10-rủi-ro--giảm-thiểu)

---

## 1. Tổng quan & Mục tiêu

### Vấn đề

Luồng sinh câu hỏi hiện tại (`POST /ai-questions/generate`) gọi LLM từ backend — yêu cầu API key trả phí (Anthropic / OpenAI / Gemini) và trừ quota tổ chức. Người dùng muốn tận dụng model đang chạy trên máy local (Ollama, LM Studio) để sinh câu hỏi mà không tốn tiền.

### Mục tiêu

| #   | Mục tiêu                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------- |
| M1  | Frontend có thể liệt kê model từ Ollama / LM Studio theo chuẩn OpenAI-compatible hoặc Anthropic-compatible |
| M2  | Người dùng chọn model, nhập ngữ cảnh, sinh câu hỏi trực tiếp từ browser → local LLM                        |
| M3  | Câu hỏi qua bước review rồi mới đẩy vào BrainGym Intake (`mcp/intake`)                                     |
| M4  | Không tốn API fee, không đốt quota backend                                                                 |
| M5  | Lỗi CORS / unreachable / dialect sai được chẩn đoán rõ ràng, có hướng dẫn khắc phục                        |

### Không trong phạm vi (v1)

- Backend tự gọi local LLM (bất khả thi với SaaS multi-tenant)
- Auto-approve không qua review con người
- Fine-tuning / quản lý model
- Org-scoped intake (dùng intake cá nhân trước)

---

## 2. Phân tích hiện trạng

### Luồng cloud hiện tại

```
[Browser] → POST /ai-questions/generate (JWT)
              → LlmQuotaService.enforceQuota()
              → BullMQ job → ai-gen.processor.ts
                 → createLlmProvider(provider, encryptedKey)
                    → AnthropicProvider | OpenAiProvider | GeminiProvider
                       → LLM API (cloud)
              → POST /ai-questions/save
```

### Điểm tái dụng (không cần xây lại)

| Thành phần                        | File                                             | Tái dụng như thế nào                                               |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `POST /ai-questions/mcp/intake`   | `ai-question-bank.controller.ts:180`             | Endpoint nhận câu hỏi local sau khi review                         |
| `mcpIntake()`                     | `ai-question-bank.service.ts:306`                | Quality score → tier → `APPROVED`/`PENDING` → `questions.create()` |
| `McpIntakeDto` / `McpQuestionDto` | `mcp-intake.dto.ts`                              | Schema validate câu hỏi gửi lên                                    |
| `GeneratedQuestionsReview`        | `src/components/ai-questions/`                   | UI review / edit câu hỏi trước khi submit                          |
| `LlmConfigPanel`                  | `src/components/ai-questions/LlmConfigPanel.tsx` | Mở rộng thêm section "Local LLM"                                   |
| `GenerationForm`                  | `src/components/ai-questions/GenerationForm.tsx` | Mở rộng chọn provider LOCAL                                        |

### Lý do frontend gọi local, không phải backend

Backend chạy trên server/Docker — không thể kết nối tới `localhost` của máy người dùng. Đây là ràng buộc SaaS không thể thay đổi. Mọi lưu lượng local LLM **phải** xuất phát từ browser.

---

## 3. Kiến trúc giải pháp

### Sơ đồ luồng

```
┌─────────────────────────────── Browser ─────────────────────────────────┐
│                                                                           │
│  LlmConfigPanel (Local tab)                                               │
│    ├── chọn Dialect (OpenAI-compat | Anthropic-compat | Ollama native)   │
│    ├── nhập Base URL (prefill: localhost:11434, localhost:1234/v1, ...)   │
│    ├── [Refresh models] → LocalLlmClient.listModels()                    │
│    │       └── GET {baseUrl}/models  |  GET {baseUrl}/api/tags           │
│    ├── dropdown chọn model                                                │
│    └── lưu config → localStorage                                         │
│                                                                           │
│  GenerationForm (provider = LOCAL)                                        │
│    └── [Generate] → LocalLlmClient.generate(prompt)                      │
│           └── POST {baseUrl}/chat/completions | /messages | /api/generate │
│                                                                           │
│  parse JSON → Zod validate → repair (nếu lệch schema)                    │
│                                                                           │
│  GeneratedQuestionsReview (tái dụng)                                      │
│    └── user review / edit / discard                                       │
│                                                                           │
│  [Submit to BrainGym]                                                     │
│    └── POST /api/v1/ai-questions/mcp/intake  (JWT Bearer)                │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                                          │
                              ┌───────────▼──────────────┐
                              │  BrainGym Backend (NestJS) │
                              │  mcpIntake()               │
                              │  scoreTotier()             │
                              │  questions.create()        │
                              └────────────────────────────┘
```

---

## 4. Thiết kế kỹ thuật chi tiết

### 4.1 LocalLlmDialect — lớp trừu tượng

Định nghĩa một type `LocalLlmDialect` mô tả cách một server local expose API:

```typescript
// src/services/local-llm/types.ts

export type LocalLlmDialect = "openai" | "anthropic" | "ollama";

export interface LocalLlmConfig {
  dialect: LocalLlmDialect;
  baseUrl: string; // vd: "http://localhost:11434"
  modelId: string; // vd: "llama3.2:3b"
  apiKey?: string; // thường bỏ trống với local
}

export interface LocalModelInfo {
  id: string; // định danh để gọi generate
  name: string; // hiển thị UI
  sizeLabel?: string; // "3B", "7B"... nếu server cung cấp
}

export interface LocalLlmGenerateResult {
  rawText: string; // text thô từ model
  model: string;
}
```

**Bảng ánh xạ dialect → endpoint:**

| Dialect     | List models endpoint | Parser field    | Generate endpoint        | Auth header                                  |
| ----------- | -------------------- | --------------- | ------------------------ | -------------------------------------------- |
| `openai`    | `GET /models`        | `data[].id`     | `POST /chat/completions` | `Authorization: Bearer <key>`                |
| `anthropic` | `GET /models`        | `data[].id`     | `POST /messages`         | `x-api-key`, `anthropic-version: 2023-06-01` |
| `ollama`    | `GET /api/tags`      | `models[].name` | `POST /api/generate`     | (không cần)                                  |

> **Lưu ý:** Ollama từ v0.1.24 hỗ trợ OpenAI-compat tại `/v1`. Khuyến nghị users dùng `openai` dialect với Ollama (`baseUrl = http://localhost:11434/v1`) để thống nhất. Dialect `ollama` native giữ làm fallback auto-detect.

**Phủ sóng thực tế:**

| Tool             | Dialect khuyến nghị | Default base URL            |
| ---------------- | ------------------- | --------------------------- |
| Ollama           | `openai`            | `http://localhost:11434/v1` |
| LM Studio        | `openai`            | `http://localhost:1234/v1`  |
| llama.cpp server | `openai`            | `http://localhost:8080/v1`  |
| vLLM             | `openai`            | `http://localhost:8000/v1`  |
| LocalAI          | `openai`            | `http://localhost:8080/v1`  |
| Jan              | `openai`            | `http://localhost:1337/v1`  |
| Anthropic proxy  | `anthropic`         | `http://localhost:8081`     |

---

### 4.2 Model discovery

```typescript
// src/services/local-llm/local-llm-client.ts

export class LocalLlmClient {
  async listModels(config: LocalLlmConfig): Promise<LocalModelInfo[]>;
  // 1. Gọi endpoint theo dialect
  // 2. Nếu 404 và dialect là 'openai' → fallback thử /api/tags (Ollama native)
  // 3. Phân biệt lỗi: CORS | network unreachable | 404 (wrong dialect) | empty list

  async testConnection(
    config: Omit<LocalLlmConfig, "modelId">,
  ): Promise<ConnectionTestResult>;
}

export type ConnectionTestResult =
  | { ok: true; models: LocalModelInfo[] }
  | {
      ok: false;
      reason: "cors" | "unreachable" | "wrong_dialect" | "empty";
      hint: string;
    };
```

**Logic auto-detect (khi user nhập base URL mà chưa chọn dialect):**

```
1. GET {baseUrl}/models          → nếu 200 + data[] → dialect: openai
2. GET {baseUrl}/api/tags        → nếu 200 + models[] → dialect: ollama
3. GET {baseUrl}/models (anthropic headers) → dialect: anthropic
4. Nếu tất cả fail → trả về 'unreachable' hoặc 'cors'
```

---

### 4.3 Sinh câu hỏi (generate)

Prompt template được xây từ ngữ cảnh form (certification, domain, difficulty, question count, questionType). Dùng lại cấu trúc prompt đã thiết kế ở backend providers để đảm bảo chất lượng đồng nhất:

```typescript
async generateQuestions(
  config: LocalLlmConfig,
  params: GenerationParams
): Promise<LocalLlmGenerateResult>
```

**Cấu trúc JSON yêu cầu model trả về** (nhúng vào system prompt):

```json
{
  "questions": [
    {
      "question": "string",
      "choices": [
        { "label": "A", "content": "string", "isCorrect": false },
        { "label": "B", "content": "string", "isCorrect": true }
      ],
      "explanation": "string",
      "source_passage": "string (optional)",
      "quality_score": 0.85
    }
  ]
}
```

**Mapping dialect → generate request:**

| Dialect     | Payload key cho nội dung                             | Cách set system prompt           |
| ----------- | ---------------------------------------------------- | -------------------------------- |
| `openai`    | `messages[{role:"system",...},{role:"user",...}]`    | message đầu với `role: "system"` |
| `anthropic` | `messages[{role:"user",...}]` + field `system` riêng | field `system` ở top-level       |
| `ollama`    | `prompt` (string đơn)                                | prefix vào `prompt`              |

---

### 4.4 JSON validation & repair

Model local hay trả JSON lệch — đây là rủi ro #2. Quy trình xử lý theo pipeline:

````
rawText
  → bước 1: JSON.parse() thẳng
  → bước 2: extract từ markdown fence (```json ... ```)
  → bước 3: extractBalancedJson() — tìm { } đầu tiên cân bằng
  → bước 4: Zod parse theo schema LocalQuestionsResponseSchema
       - isCorrect missing → default false
       - choices < 2 → discard question + warn user
       - quality_score missing → default 0.5
  → bước 5: nếu < 1 question hợp lệ → báo lỗi, cho retry
  → bước 6: hiển thị lên GeneratedQuestionsReview với số câu hợp lệ / tổng
````

**Schema Zod (frontend mirror của `McpQuestionDto`):**

```typescript
// src/services/local-llm/schema.ts

const LocalChoiceSchema = z.object({
  label: z.string().min(1),
  content: z.string().min(1),
  isCorrect: z.boolean().default(false),
});

const LocalQuestionSchema = z.object({
  question: z.string().min(10),
  choices: z.array(LocalChoiceSchema).min(2).max(6),
  explanation: z.string().optional(),
  source_passage: z.string().optional(),
  quality_score: z.number().min(0).max(1).default(0.5),
});

export const LocalQuestionsResponseSchema = z.object({
  questions: z.array(LocalQuestionSchema).min(1),
});
```

---

### 4.5 Intake vào BrainGym

Sau khi user duyệt tại `GeneratedQuestionsReview`, map sang `McpIntakeDto` và POST:

```typescript
// src/services/local-llm/submit-intake.ts

export async function submitLocalQuestionsToIntake(
  questions: ValidatedLocalQuestion[],
  context: {
    certificationId: string;
    domainId?: string;
    difficulty?: Difficulty;
    questionType?: QuestionType;
  },
): Promise<McpIntakeResponse>;
```

Gọi endpoint: `POST /api/v1/ai-questions/mcp/intake`

**Behavior quality gate của intake hiện tại (không thay đổi):**

| quality_score | Status sau intake           |
| ------------- | --------------------------- |
| ≥ 0.8         | `APPROVED`                  |
| 0.5 – 0.79    | `PENDING` (chờ admin duyệt) |
| < 0.5         | discarded                   |

Câu hỏi từ model local không có `quality_score` đáng tin → default `0.6` → `PENDING` (an toàn, cần admin duyệt thêm).

---

### 4.6 Lưu trữ cấu hình local

Cấu hình local LLM **không** lưu DB (không có secret server-side cần encrypt). Dùng `localStorage`:

```typescript
// src/services/local-llm/config-storage.ts

export interface StoredLocalLlmConfig {
  dialect: LocalLlmDialect;
  baseUrl: string;
  modelId: string;
  apiKey?: string;
  savedAt: string;       // ISO 8601
}

// Key: "braingym:local-llm-config"

export const localLlmConfigStorage = {
  get(): StoredLocalLlmConfig | null,
  set(config: StoredLocalLlmConfig): void,
  clear(): void,
};
```

---

### 4.7 UI — mở rộng LlmConfigPanel

Thêm tab/section **"Local LLM"** tách biệt với phần cloud BYOK hiện tại (không làm hỏng flow cũ):

```
LlmConfigPanel
  ├── [Cloud Providers]  ← giữ nguyên hoàn toàn
  └── [Local LLM]         ← mới
        ├── Dialect selector
        │     • OpenAI-compatible (Ollama, LM Studio, llama.cpp, vLLM...)  ← default
        │     • Anthropic-compatible (proxy)  ← "(Advanced)"
        │     • Ollama native
        ├── Base URL input
        │     placeholder theo dialect đã chọn
        ├── API Key input (optional)
        │     placeholder: "Leave empty — not needed for local"
        │     ⚠️  warning: "Đừng nhập API key cloud vào đây"
        ├── [Test Connection] button
        │     loading state → kết quả:
        │       ✅ Connected — N models found
        │       ❌ CORS blocked  [Xem hướng dẫn ▾]
        │       ❌ Unreachable — kiểm tra Ollama đang chạy
        │       ❌ Wrong dialect — thử đổi sang OpenAI-compatible
        │       ⚠️  No models — load model vào LM Studio trước
        ├── Model dropdown (populate sau khi test OK)
        ├── [Save local config]
        └── [CORS setup guide ▾] (fold/unfold)
              Ollama:  OLLAMA_ORIGINS=<domain> ollama serve
              LM Studio: Settings → Local Server → CORS
```

**Tại `GenerationForm`:**

- Thêm option `LOCAL` trong provider selector
- Khi chọn LOCAL: hiển thị model đã lưu (từ localStorage), ẩn field "API Key"
- Khi chưa có config → hiển thị banner "Chưa cấu hình Local LLM" + link Settings

---

## 5. Xử lý lỗi & UX

| Tình huống              | Phát hiện                                   | Thông báo người dùng                                                                                      |
| ----------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| CORS blocked            | `fetch` throw `TypeError` với URL localhost | "CORS blocked. Thêm origin BrainGym vào `OLLAMA_ORIGINS` hoặc bật CORS trong LM Studio." + link hướng dẫn |
| Server không chạy       | Connection refused                          | "Không kết nối được đến {baseUrl}. Kiểm tra Ollama/LM Studio đang chạy."                                  |
| 404 endpoint            | HTTP 404                                    | "Endpoint không đúng. Thử đổi sang dialect OpenAI-compatible."                                            |
| List model rỗng         | 200 + `data = []`                           | "Không có model nào đang nạp. Load model trong LM Studio trước khi refresh."                              |
| JSON output lệch schema | Zod parse fail                              | "Model trả về {valid}/{total} câu hợp lệ. Thử lại hoặc chọn model khác."                                  |
| 0 câu hợp lệ            | valid = 0                                   | Nút Retry nổi bật, không cho phép submit                                                                  |
| Intake fail — auth      | 401 từ backend                              | "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại."                                                        |
| Intake fail — server    | 5xx từ backend                              | "Lỗi hệ thống. Câu hỏi chưa được lưu, thử lại sau."                                                       |

**Phân biệt CORS vs unreachable** (quan trọng, 2 lỗi trông giống nhau):

```typescript
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  // ...
} catch (err) {
  if (err instanceof TypeError && err.message.includes('fetch')) {
    // Kiểm tra: thử fetch không có CORS header để xác nhận
    // → nếu fail tương tự: 'unreachable'
    // → nếu có response headers nhưng bị block: 'cors'
  }
  if (err.name === 'TimeoutError') → 'unreachable'
}
```

---

## 6. Bảo mật

| Vấn đề                                 | Giải pháp                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------- |
| SSRF từ browser — user nhập URL tùy ý  | Whitelist chỉ `localhost`, `127.0.0.1`, `[::1]`, `*.local` trước khi fetch |
| API key cloud vô tình lưu localStorage | Warning rõ trong UI; label field là "optional, for local auth only"        |
| JSON injection từ model output         | Parse `JSON.parse()` (không `eval`), validate Zod trước khi render         |
| Câu hỏi chất lượng thấp vào bank       | Human review bắt buộc + intake quality gate → `PENDING` mặc định           |
| Intake endpoint                        | JWT guard giữ nguyên, không thay đổi                                       |

---

## 7. Backend — thay đổi tối thiểu

Luồng local LLM **không yêu cầu** thay đổi backend. Các bổ sung dưới đây là **tùy chọn** để cải thiện observability:

### Tùy chọn A — Thêm provenance vào McpIntakeDto _(khuyến nghị làm ngay)_

```typescript
// backend/src/ai-question-bank/mcp/mcp-intake.dto.ts

@IsOptional()
source?: 'MCP' | 'LOCAL_LLM';    // truy vết nguồn câu hỏi

@IsOptional()
localModelId?: string;           // vd: "llama3.2:3b"
```

Không breaking change — field optional, intake hiện tại vẫn chạy đúng.

### Tùy chọn B — Thêm `LOCAL` vào enum LlmProvider _(sprint sau)_

```prisma
// backend/prisma/schema.prisma
enum LlmProvider {
  OPENAI
  ANTHROPIC
  GEMINI
  LOCAL      // ← nếu muốn tracking job/usage analytics
}
```

---

## 8. Kế hoạch triển khai

### Effort ước tính: **5.5–7 SP** (Frontend-heavy)

| Phạm vi                   | SP       |
| ------------------------- | -------- |
| Frontend (Task 1–4)       | 5 SP     |
| Backend optional (Task 5) | 0.5 SP   |
| Test & QA (Task 6)        | 1.5 SP   |
| **Tổng**                  | **7 SP** |

---

### Task 1 — Lớp trừu tượng & Model discovery (2 SP)

**Files mới:**

- `src/services/local-llm/types.ts`
- `src/services/local-llm/local-llm-client.ts`
- `src/services/local-llm/config-storage.ts`

**Checklist:**

- [ ] Định nghĩa `LocalLlmDialect`, `LocalLlmConfig`, `LocalModelInfo`, `ConnectionTestResult`
- [ ] `listModels()` cho cả 3 dialect (openai / anthropic / ollama)
- [ ] Auto-detect: thử OpenAI endpoint → fallback Ollama native `/api/tags`
- [ ] `testConnection()` → phân loại 4 loại kết quả (ok / cors / unreachable / wrong_dialect / empty)
- [ ] Base URL validator: chỉ cho phép localhost / 127.0.0.1 / [::1] / \*.local
- [ ] `localLlmConfigStorage` (get / set / clear với key `braingym:local-llm-config`)
- [ ] Unit test (vitest): mock fetch, test từng dialect, test mỗi loại lỗi

---

### Task 2 — Prompt builder, generate & JSON validation (2 SP)

**Files mới:**

- `src/services/local-llm/prompt-builder.ts`
- `src/services/local-llm/schema.ts`

**Files sửa:**

- `src/services/local-llm/local-llm-client.ts` — thêm `generateQuestions()`

**Checklist:**

- [ ] `buildPrompt(params: GenerationParams): { system: string; user: string }` — tái dụng cấu trúc prompt từ backend providers làm chuẩn
- [ ] `generateQuestions()` cho cả 3 dialect (payload format khác nhau theo bảng §4.3)
- [ ] `extractAndValidate(rawText): { valid: ValidatedLocalQuestion[]; total: number }` — pipeline 6 bước §4.4
- [ ] Zod schema `LocalQuestionsResponseSchema`
- [ ] Unit test: JSON hoàn hảo, JSON trong markdown fence, JSON broken, JSON hoàn toàn sai, 0 câu hợp lệ

---

### Task 3 — UI: LlmConfigPanel mở rộng Local tab (1 SP)

**Files sửa:**

- `src/components/ai-questions/LlmConfigPanel.tsx`

**Checklist:**

- [ ] Thêm tab / section "Local LLM" không làm hỏng flow cloud hiện tại
- [ ] Dialect selector (3 options, `openai` là default)
- [ ] Base URL input với placeholder thay đổi theo dialect
- [ ] API Key input (optional) + warning không nhập key cloud
- [ ] Nút "Test Connection" + hiển thị kết quả (`ConnectionTestResult`)
- [ ] Model dropdown (populate sau khi test OK), disabled khi chưa test
- [ ] Nút "Save" → `localLlmConfigStorage.set()`
- [ ] CORS setup guide (fold/unfold, nội dung theo §5)

---

### Task 4 — GenerationForm (LOCAL provider) + submit intake (1 SP)

**Files sửa:**

- `src/components/ai-questions/GenerationForm.tsx`

**Files mới:**

- `src/services/local-llm/submit-intake.ts`

**Checklist:**

- [ ] Thêm option `LOCAL` trong provider selector
- [ ] Khi chọn LOCAL: hiển thị model từ localStorage, ẩn API key field
- [ ] Khi chưa cấu hình LOCAL → banner + link Settings
- [ ] Gọi `LocalLlmClient.generateQuestions()` khi submit form
- [ ] Hiển thị kết quả qua `GeneratedQuestionsReview` (tái dụng, không sửa)
- [ ] `submitToIntake()`: map sang `McpIntakeDto` → `POST /ai-questions/mcp/intake`
- [ ] Toast success ("N câu đã gửi vào ngân hàng") / error phân loại

---

### Task 5 — Backend: provenance field (0.5 SP)

**Files sửa:**

- `backend/src/ai-question-bank/mcp/mcp-intake.dto.ts`

**Checklist:**

- [ ] Thêm `source?: 'MCP' | 'LOCAL_LLM'` (optional, `@IsOptional()`)
- [ ] Thêm `localModelId?: string` (optional, `@IsOptional()`)
- [ ] Không thay đổi logic `mcpIntake()` — chỉ lưu thêm metadata

---

### Task 6 — Test & QA (1.5 SP)

**Checklist:**

- [ ] Unit test Task 1 + Task 2 đủ các edge case
- [ ] E2E Playwright: mock local LLM endpoint → generate → review → submit intake → verify question tạo ra ở trạng thái PENDING
- [ ] Test lỗi CORS: mock server không có CORS header → verify error message đúng loại
- [ ] Test JSON hỏng: mock trả markdown + broken JSON → verify pipeline repair
- [ ] Test thực tế với Ollama (integration test hoặc manual)
- [ ] Test thực tế với LM Studio (manual)
- [ ] Accessibility: keyboard navigation trên model dropdown, aria-label
- [ ] Responsive: mobile 375px (form, dropdown)

---

### Sơ đồ phụ thuộc task

```
Task 1 ──→ Task 2 ──→ Task 4
Task 1 ──→ Task 3
Task 5    (độc lập)
Task 6    (sau Task 1–4 hoàn thành)
```

Task 1 và Task 5 có thể làm song song trong cùng sprint.

---

## 9. Acceptance Criteria

| #     | Điều kiện                                                                    | Kết quả mong đợi                                                              |
| ----- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| AC-1  | Cấu hình Ollama (`openai` dialect, `localhost:11434/v1`) → Test Connection   | ✅ danh sách model đang nạp                                                   |
| AC-2  | Cấu hình LM Studio (`openai` dialect, `localhost:1234/v1`) → Test Connection | ✅ model đang load trong LM Studio                                            |
| AC-3  | Ollama chưa set `OLLAMA_ORIGINS` → Test Connection                           | ❌ "CORS blocked" + hướng dẫn                                                 |
| AC-4  | Ollama không chạy → Test Connection                                          | ❌ "Unreachable"                                                              |
| AC-5  | Base URL sai dialect (404)                                                   | ❌ "Wrong dialect — thử OpenAI-compatible"                                    |
| AC-6  | Generate 5 câu từ Ollama (llama3.2:3b)                                       | Hiển thị đủ 5 câu trong review; không call API cloud; không trừ quota         |
| AC-7  | Model trả JSON lệch schema (thiếu field)                                     | Hiển thị "{valid}/5 câu hợp lệ" + tùy chọn retry                              |
| AC-8  | Model trả hoàn toàn không phải JSON                                          | 0 câu hợp lệ, nút Retry nổi bật, không cho submit                             |
| AC-9  | Submit sau khi review                                                        | Câu hỏi xuất hiện trong bank với status `PENDING`                             |
| AC-10 | Chưa cấu hình Local LLM nhưng chọn provider LOCAL                            | Banner hướng dẫn, không crash                                                 |
| AC-11 | Verify không tạo cloud API call                                              | DevTools Network: không có request đến `api.anthropic.com` / `api.openai.com` |
| AC-12 | Verify không tạo `QuestionGenerationJob` record                              | Không xuất hiện entry mới trong `/ai-questions/history`                       |

---

## 10. Rủi ro & Giảm thiểu

| Rủi ro                                   | Mức            | Giảm thiểu                                                                                                   |
| ---------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| CORS blocked browser → localhost         | **Cao**        | UI hướng dẫn `OLLAMA_ORIGINS`; Test Connection chẩn đoán chính xác; docs inline                              |
| JSON output kém từ model nhỏ (7B/8B)     | **Cao**        | Pipeline repair 6 bước; Zod validate; human review bắt buộc; default `quality_score = 0.6` → PENDING         |
| Mixed content HTTPS app → HTTP localhost | **Trung bình** | Chrome/Firefox/Edge OK với localhost (potentially trustworthy); Safari cần test và có thể cần hướng dẫn thêm |
| LM Studio chỉ list model đang load       | **Thấp–TB**    | Ghi chú UI rõ ràng; hướng dẫn load model trước                                                               |
| API key cloud vô tình lưu localStorage   | **Thấp**       | Warning trong UI; label field là "optional, local auth only"                                                 |
| Anthropic-compat proxy ít server hỗ trợ  | **Thấp**       | Đánh dấu "(Advanced)"; mặc định OpenAI-compat; không ưu tiên trong demo/docs                                 |
| SSRF từ browser — URL tùy ý              | **Thấp**       | Whitelist localhost/loopback validate trước khi fetch                                                        |

---

_Document này theo dõi thiết kế feature US-XXXX — Local LLM Question Generation.
Cập nhật khi có thay đổi thiết kế hoặc sau sprint review._
