# Local LLM Question Generation

> **Feature:** US-XXXX — Question generation from Local LLM (Ollama / LM Studio)
> **Version:** 1.0
> **Date:** 2026-05-31
> **Status:** Design — Awaiting Implementation
> **Author:** ThanhPT

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Current State Analysis](#2-current-state-analysis)
3. [Solution Architecture](#3-solution-architecture)
4. [Technical Design](#4-technical-design)
   - 4.1 [LocalLlmDialect — abstraction layer](#41-localllmdialect--abstraction-layer)
   - 4.2 [Model discovery](#42-model-discovery)
   - 4.3 [Question generation](#43-question-generation)
   - 4.4 [JSON validation & repair](#44-json-validation--repair)
   - 4.5 [Intake into CertGym](#45-intake-into-certgym)
   - 4.6 [Local config storage](#46-local-config-storage)
   - 4.7 [UI — extending LlmConfigPanel](#47-ui--extending-llmconfigpanel)
5. [Error Handling & UX](#5-error-handling--ux)
6. [Security](#6-security)
7. [Backend — minimal changes](#7-backend--minimal-changes)
8. [Implementation Plan](#8-implementation-plan)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [Risks & Mitigations](#10-risks--mitigations)

---

## 1. Overview & Goals

### Problem

The current question generation flow (`POST /api/v1/ai-questions/generate`) calls an LLM from the backend — requiring a paid API key (Anthropic / OpenAI / Gemini) and consuming org quota. Users want to leverage models running locally (Ollama, LM Studio) to generate questions without cost.

### Goals

| #   | Goal                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------ |
| M1  | Frontend can list models from any self-hosted LLM (Ollama, LM Studio, vLLM, Jan, etc.) via OpenAI-compatible or Anthropic-compatible API |
| M2  | User selects a model, enters context, and generates questions directly from the browser to the self-hosted LLM |
| M3  | Questions go through a human review step before being pushed into CertGym via intake (`mcp/intake`)    |
| M4  | No API fees, no backend quota consumption                                                              |
| M5  | CORS / unreachable / wrong dialect errors are diagnosed clearly with remediation guidance               |

### Out of scope (v1)

- Backend calling a local LLM (infeasible for SaaS multi-tenant)
- Auto-approve without human review
- Fine-tuning / model management
- Org-scoped intake (personal intake first)

---

## 2. Current State Analysis

### Existing cloud flow

```
[Browser] → POST /api/v1/ai-questions/generate (JWT)
              → LlmQuotaService.enforceQuota()
              → BullMQ job → ai-gen.processor.ts
                 → createLlmProvider(provider, encryptedKey)
                    → AnthropicProvider | OpenAiProvider | GeminiProvider
                       → LLM API (cloud)
              → POST /api/v1/ai-questions/save
```

### Reusable components (no rebuild needed)

| Component                         | File                                             | How it is reused                                                    |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| `POST /api/v1/ai-questions/mcp/intake` | `ai-question-bank.controller.ts` line 211   | Endpoint that receives local-generated questions after review       |
| `mcpIntake()`                     | `ai-question-bank.service.ts` line 296           | Scores quality → tier → `APPROVED`/`PENDING` → `questions.create()` |
| `McpIntakeDto` / `McpQuestionDto` | `mcp-intake.dto.ts`                              | Schema for validating questions sent to intake                      |
| `GeneratedQuestionsReview`        | `src/components/ai-questions/`                   | UI for reviewing / editing questions before submit                  |
| `LlmConfigPanel`                  | `src/components/ai-questions/LlmConfigPanel.tsx` | Extend with a "Local LLM" section                                   |
| `GenerationForm`                  | `src/components/ai-questions/GenerationForm.tsx` | Extend to support `LOCAL` provider selection                        |

### Why the frontend calls the GenAI endpoint directly, not the backend

The backend runs on a server/Docker container — it cannot reach the user's local network. This is an immutable SaaS constraint. All requests to GenAI endpoints **must** originate from the browser.

**Any `http://` or `https://` URL is accepted:**

| Type               | Example                                |
| ------------------ | -------------------------------------- |
| Localhost          | `http://localhost:11434/v1`            |
| LAN / private IP   | `http://192.168.1.100:8080/v1`         |
| mDNS               | `http://gpu-box.local:11434/v1`        |
| VPC / internal hostname | `https://inference.company.com/v1` |
| Docker/K8s service | `http://ollama-svc:11434/v1`           |

No IP/hostname allowlist — the only constraint is the **browser CORS policy**: if the server does not set `Access-Control-Allow-Origin`, the browser blocks the response before data can be read.

**Note:** If the URL matches an official cloud provider hostname (`api.openai.com`, `api.anthropic.com`, etc.), the UI warns the user to use the Cloud Providers (BYOK) section instead.

---

## 3. Solution Architecture

### Flow diagram

```
┌─────────────────────────────── Browser ─────────────────────────────────┐
│                                                                           │
│  LlmConfigPanel (Local tab)                                               │
│    ├── choose Dialect (OpenAI-compat | Anthropic-compat | Ollama native) │
│    ├── enter Base URL (prefill: localhost:11434, localhost:1234/v1, ...)  │
│    ├── [Refresh models] → LocalLlmClient.listModels()                    │
│    │       └── GET {baseUrl}/models  |  GET {baseUrl}/api/tags           │
│    ├── model dropdown                                                     │
│    └── save config → localStorage                                        │
│                                                                           │
│  GenerationForm (provider = LOCAL)                                        │
│    └── [Generate] → LocalLlmClient.generate(prompt)                      │
│           └── POST {baseUrl}/chat/completions | /messages | /api/generate │
│                                                                           │
│  parse JSON → Zod validate → repair (if schema drift)                    │
│                                                                           │
│  GeneratedQuestionsReview (reused)                                        │
│    └── user review / edit / discard                                       │
│                                                                           │
│  [Submit to CertGym]                                                      │
│    └── POST /api/v1/ai-questions/mcp/intake  (JWT Bearer)                │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                                          │
                              ┌───────────▼──────────────┐
                              │  CertGym Backend (NestJS) │
                              │  mcpIntake()              │
                              │  scoreTotier()            │
                              │  questions.create()       │
                              └────────────────────────────┘
```

---

## 4. Technical Design

### 4.1 LocalLlmDialect — abstraction layer

Define a `LocalLlmDialect` type describing how a local server exposes its API:

```typescript
// src/services/local-llm/types.ts

export type LocalLlmDialect = "openai" | "anthropic" | "ollama";

export interface LocalLlmConfig {
  dialect: LocalLlmDialect;
  baseUrl: string; // e.g. "http://localhost:11434"
  modelId: string; // e.g. "llama3.2:3b"
  apiKey?: string; // usually empty for local
}

export interface LocalModelInfo {
  id: string; // identifier used in generate calls
  name: string; // display name in UI
  sizeLabel?: string; // "3B", "7B"... if server provides it
}

export interface LocalLlmGenerateResult {
  rawText: string; // raw model output
  model: string;
}
```

**Dialect → endpoint mapping:**

| Dialect     | List models endpoint | Parser field    | Generate endpoint        | Auth header                                  |
| ----------- | -------------------- | --------------- | ------------------------ | -------------------------------------------- |
| `openai`    | `GET /models`        | `data[].id`     | `POST /chat/completions` | `Authorization: Bearer <key>`                |
| `anthropic` | `GET /models`        | `data[].id`     | `POST /messages`         | `x-api-key`, `anthropic-version: 2023-06-01` |
| `ollama`    | `GET /api/tags`      | `models[].name` | `POST /api/generate`     | (not required)                               |

> **Note:** Ollama from v0.1.24 supports OpenAI-compat at `/v1`. Recommend users use `openai` dialect with Ollama (`baseUrl = http://localhost:11434/v1`) for consistency. The `ollama` native dialect is kept as an auto-detect fallback.

**Practical coverage:**

| Tool             | Recommended dialect | Default base URL            |
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
  // 1. Call endpoint per dialect
  // 2. If 404 and dialect is 'openai' → fallback to /api/tags (Ollama native)
  // 3. Distinguish error types: CORS | network unreachable | 404 (wrong dialect) | empty list

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

**Auto-detect logic (when user enters a base URL without selecting a dialect):**

```
1. GET {baseUrl}/models          → if 200 + data[] → dialect: openai
2. GET {baseUrl}/api/tags        → if 200 + models[] → dialect: ollama
3. GET {baseUrl}/models (anthropic headers) → dialect: anthropic
4. If all fail → return 'unreachable' or 'cors'
```

---

### 4.3 Question generation

The prompt template is built from the form context (certification, domain, difficulty, question count, questionType). Reuse the prompt structure from the backend providers to ensure consistent quality:

```typescript
async generateQuestions(
  config: LocalLlmConfig,
  params: GenerationParams
): Promise<LocalLlmGenerateResult>
```

**JSON structure requested from the model** (embedded in the system prompt):

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

**Dialect → generate request mapping:**

| Dialect     | Payload key for content                               | How to set system prompt          |
| ----------- | ----------------------------------------------------- | --------------------------------- |
| `openai`    | `messages[{role:"system",...},{role:"user",...}]`     | first message with `role: "system"` |
| `anthropic` | `messages[{role:"user",...}]` + top-level `system`   | top-level `system` field          |
| `ollama`    | `prompt` (single string)                              | prefix into `prompt`              |

---

### 4.4 JSON validation & repair

Local models frequently return malformed JSON — this is risk #2. Processing pipeline:

````
rawText
  → step 1: JSON.parse() directly
  → step 2: extract from markdown fence (```json ... ```)
  → step 3: extractBalancedJson() — find the first balanced { }
  → step 4: Zod parse with LocalQuestionsResponseSchema
       - isCorrect missing → default false
       - choices < 2 → discard question + warn user
       - quality_score missing → default 0.5
  → step 5: if < 1 valid question → error, allow retry
  → step 6: display in GeneratedQuestionsReview with valid/total count
````

**Zod schema (frontend mirror of `McpQuestionDto`):**

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

### 4.5 Intake into CertGym

After the user approves questions in `GeneratedQuestionsReview`, map to `McpIntakeDto` and POST:

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

Endpoint: `POST /api/v1/ai-questions/mcp/intake`

**Intake quality gate (existing behavior, unchanged):**

The backend uses two constants: `QUALITY_HIGH = 0.85` and `QUALITY_MEDIUM = 0.6` (defined in `ai-question-bank.service.ts`).

| quality_score  | Status after intake                   |
| -------------- | ------------------------------------- |
| ≥ 0.85         | `APPROVED`                            |
| 0.60 – 0.84    | `PENDING` (awaiting admin review)     |
| < 0.60         | discarded (not saved)                 |

Questions from local models lack a reliable `quality_score`. The `mcpIntake()` service defaults a missing `quality_score` to `0.7`, which maps to `PENDING` — a safe default requiring admin review.

---

### 4.6 Local config storage

Local LLM config is **not** stored in the database (no server-side secret to encrypt). Use `localStorage`:

```typescript
// src/services/local-llm/config-storage.ts

export interface StoredLocalLlmConfig {
  dialect: LocalLlmDialect;
  baseUrl: string;
  modelId: string;
  apiKey?: string;
  savedAt: string; // ISO 8601
}

// Key: "braingym:local-llm-config"

export const localLlmConfigStorage = {
  get(): StoredLocalLlmConfig | null,
  set(config: StoredLocalLlmConfig): void,
  clear(): void,
};
```

---

### 4.7 UI — extending LlmConfigPanel

Add a **"Local LLM"** tab/section separate from the existing cloud BYOK section (no disruption to the existing flow):

```
LlmConfigPanel
  ├── [Cloud Providers]  ← unchanged
  └── [Local LLM]         ← new
        ├── Dialect selector
        │     • OpenAI-compatible (Ollama, LM Studio, llama.cpp, vLLM...)  ← default
        │     • Anthropic-compatible (proxy)  ← "(Advanced)"
        │     • Ollama native
        ├── Base URL input
        │     placeholder changes per dialect
        ├── API Key input (optional)
        │     placeholder: "Leave empty — not needed for local"
        │     ⚠️  warning: "Do not enter a cloud API key here"
        ├── [Test Connection] button
        │     loading state → result:
        │       ✅ Connected — N models found
        │       ❌ CORS blocked  [View setup guide ▾]
        │       ❌ Unreachable — check Ollama is running
        │       ❌ Wrong dialect — try OpenAI-compatible
        │       ⚠️  No models — load a model in LM Studio first
        ├── Model dropdown (populated after successful test)
        ├── [Save local config]
        └── [CORS setup guide ▾] (collapsible)
              Shows dynamic app origin (from window.location.origin)
              Ollama:  OLLAMA_ORIGINS=<origin> ollama serve
              LM Studio: Settings → Local Server → CORS → add origin
              llama.cpp: ./server --cors-allowed-origins "<origin>"
              vLLM: --allowed-origins '["<origin>"]'
              Custom: Set Access-Control-Allow-Origin response header
```

**In `GenerationForm`:**

- Add `LOCAL` option in the provider selector
- When LOCAL is selected: show model from localStorage, hide the API Key field
- When LOCAL is not yet configured → show a banner "Local LLM not configured" + link to Settings

---

## 5. Error Handling & UX

| Situation               | Detection                                   | User message                                                                                           |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| CORS blocked            | `fetch` throws `TypeError` for localhost URL | "CORS blocked. Add the CertGym origin to `OLLAMA_ORIGINS` or enable CORS in LM Studio." + guide link  |
| Server not running      | Connection refused                          | "Cannot connect to {baseUrl}. Check that Ollama/LM Studio is running."                                |
| 404 endpoint            | HTTP 404                                    | "Endpoint not found. Try switching to OpenAI-compatible dialect."                                      |
| Empty model list        | 200 + `data = []`                           | "No models loaded. Load a model in LM Studio before refreshing."                                       |
| JSON output schema mismatch | Zod parse failure                       | "Model returned {valid}/{total} valid questions. Try again or choose a different model."               |
| 0 valid questions       | valid = 0                                   | Retry button highlighted; submit blocked                                                               |
| Intake failure — auth   | 401 from backend                            | "Session expired. Please log in again."                                                                |
| Intake failure — server | 5xx from backend                            | "Server error. Questions were not saved, please try again."                                            |

**Distinguishing CORS vs unreachable** (important — both errors look similar):

```typescript
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  // ...
} catch (err) {
  if (err instanceof TypeError && err.message.includes('fetch')) {
    // Check: attempt fetch without CORS headers to confirm
    // → if same failure: 'unreachable'
    // → if response headers present but blocked: 'cors'
  }
  if (err.name === 'TimeoutError') // → 'unreachable'
}
```

---

## 6. Security

| Concern                                  | Mitigation                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| SSRF from browser — user enters any URL  | No server-side allowlist needed — browser CORS policy enforces access. App only validates `http`/`https` scheme. Soft warning if URL matches an official cloud provider to avoid misuse. |
| Cloud API key accidentally saved to localStorage | Clear warning in UI; field labeled "optional, for local auth only"                      |
| JSON injection from model output         | Parse via `JSON.parse()` (not `eval`); Zod validation before render                              |
| Low-quality questions entering the bank  | Mandatory human review + intake quality gate → `PENDING` by default                              |
| Intake endpoint                          | JWT guard unchanged                                                                               |

---

## 7. Backend — minimal changes

The local LLM flow **does not require** backend changes. The additions below are **optional** for improved observability:

### Option A — Add provenance to McpIntakeDto _(recommended for current sprint)_

```typescript
// backend/src/ai-question-bank/mcp/mcp-intake.dto.ts

@IsOptional()
source?: 'MCP' | 'LOCAL_LLM';    // track question origin

@IsOptional()
localModelId?: string;           // e.g. "llama3.2:3b"
```

Non-breaking — field is optional; existing intake logic continues to work.

### Option B — Add `LOCAL` to the `LlmProvider` enum _(next sprint)_

```prisma
// backend/prisma/schema.prisma
enum LlmProvider {
  OPENAI
  ANTHROPIC
  GEMINI
  LOCAL      // ← if job/usage analytics tracking is needed
}
```

---

## 8. Implementation Plan

### Estimated effort: **5.5–7 SP** (frontend-heavy)

| Scope                     | SP       |
| ------------------------- | -------- |
| Frontend (Tasks 1–4)      | 5 SP     |
| Backend optional (Task 5) | 0.5 SP   |
| Test & QA (Task 6)        | 1.5 SP   |
| **Total**                 | **7 SP** |

---

### Task 1 — Abstraction layer & Model discovery (2 SP)

**New files:**

- `src/services/local-llm/types.ts`
- `src/services/local-llm/local-llm-client.ts`
- `src/services/local-llm/config-storage.ts`

**Checklist:**

- [ ] Define `LocalLlmDialect`, `LocalLlmConfig`, `LocalModelInfo`, `ConnectionTestResult`
- [ ] `listModels()` for all 3 dialects (openai / anthropic / ollama)
- [ ] Auto-detect: try OpenAI endpoint → fallback to Ollama native `/api/tags`
- [ ] `testConnection()` → classify 4 result types (ok / cors / unreachable / wrong_dialect / empty)
- [ ] Base URL validator: allow localhost / 127.0.0.1 / [::1] / *.local
- [ ] `localLlmConfigStorage` (get / set / clear with key `braingym:local-llm-config`)
- [ ] Unit tests (vitest): mock fetch, test each dialect, test each error type

---

### Task 2 — Prompt builder, generate & JSON validation (2 SP)

**New files:**

- `src/services/local-llm/prompt-builder.ts`
- `src/services/local-llm/schema.ts`

**Modified files:**

- `src/services/local-llm/local-llm-client.ts` — add `generateQuestions()`

**Checklist:**

- [ ] `buildPrompt(params: GenerationParams): { system: string; user: string }` — reuse backend provider prompt structure for consistency
- [ ] `generateQuestions()` for all 3 dialects (payload format differs per table in §4.3)
- [ ] `extractAndValidate(rawText): { valid: ValidatedLocalQuestion[]; total: number }` — 6-step pipeline from §4.4
- [ ] Zod schema `LocalQuestionsResponseSchema`
- [ ] Unit tests: perfect JSON, JSON in markdown fence, broken JSON, completely invalid JSON, 0 valid questions

---

### Task 3 — UI: LlmConfigPanel extended with Local tab (1 SP)

**Modified files:**

- `src/components/ai-questions/LlmConfigPanel.tsx`

**Checklist:**

- [ ] Add "Local LLM" tab/section without breaking existing cloud flow
- [ ] Dialect selector (3 options, `openai` is default)
- [ ] Base URL input with placeholder changing per dialect
- [ ] API Key input (optional) + warning not to enter cloud keys
- [ ] "Test Connection" button + result display (`ConnectionTestResult`)
- [ ] Model dropdown (populated after successful test), disabled until tested
- [ ] "Save" button → `localLlmConfigStorage.set()`
- [ ] CORS setup guide (collapsible, content per §5)

---

### Task 4 — GenerationForm (LOCAL provider) + intake submit (1 SP)

**Modified files:**

- `src/components/ai-questions/GenerationForm.tsx`

**New files:**

- `src/services/local-llm/submit-intake.ts`

**Checklist:**

- [ ] Add `LOCAL` option in provider selector
- [ ] When LOCAL selected: show model from localStorage, hide API key field
- [ ] When LOCAL not configured → banner + link to Settings
- [ ] Call `LocalLlmClient.generateQuestions()` on form submit
- [ ] Display results via `GeneratedQuestionsReview` (reused, no changes)
- [ ] `submitToIntake()`: map to `McpIntakeDto` → `POST /api/v1/ai-questions/mcp/intake`
- [ ] Toast success ("N questions submitted to bank") / classified error messages

---

### Task 5 — Backend: provenance field (0.5 SP)

**Modified files:**

- `backend/src/ai-question-bank/mcp/mcp-intake.dto.ts`

**Checklist:**

- [ ] Add `source?: 'MCP' | 'LOCAL_LLM'` (optional, `@IsOptional()`)
- [ ] Add `localModelId?: string` (optional, `@IsOptional()`)
- [ ] No change to `mcpIntake()` logic — metadata only

---

### Task 6 — Test & QA (1.5 SP)

**Checklist:**

- [ ] Unit tests for Tasks 1 + 2 covering all edge cases
- [ ] E2E Playwright: mock local LLM endpoint → generate → review → submit intake → verify question created with status `PENDING`
- [ ] CORS error test: mock server with no CORS header → verify correct error classification
- [ ] Broken JSON test: mock returning markdown + broken JSON → verify repair pipeline
- [ ] Real test with Ollama (integration test or manual)
- [ ] Real test with LM Studio (manual)
- [ ] Accessibility: keyboard navigation on model dropdown, aria-labels
- [ ] Responsive: mobile 375px (form, dropdown)

---

### Task dependency diagram

```
Task 1 ──→ Task 2 ──→ Task 4
Task 1 ──→ Task 3
Task 5    (independent)
Task 6    (after Tasks 1–4 complete)
```

Tasks 1 and 5 can be worked in parallel in the same sprint.

---

## 9. Acceptance Criteria

| #     | Condition                                                                    | Expected result                                                              |
| ----- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| AC-1  | Configure Ollama (`openai` dialect, `localhost:11434/v1`) → Test Connection  | ✅ list of loaded models                                                     |
| AC-2  | Configure LM Studio (`openai` dialect, `localhost:1234/v1`) → Test Connection | ✅ model loaded in LM Studio                                               |
| AC-3  | Ollama without `OLLAMA_ORIGINS` set → Test Connection                        | ❌ "CORS blocked" + setup guide                                              |
| AC-4  | Ollama not running → Test Connection                                         | ❌ "Unreachable"                                                             |
| AC-5  | Wrong dialect base URL (404)                                                 | ❌ "Wrong dialect — try OpenAI-compatible"                                   |
| AC-6  | Generate 5 questions from Ollama (llama3.2:3b)                               | 5 questions shown in review; no cloud API call; no backend quota consumed    |
| AC-7  | Model returns JSON with missing fields                                       | Displays "{valid}/5 valid questions" + retry option                          |
| AC-8  | Model returns completely non-JSON output                                     | 0 valid questions, Retry button prominent, submit blocked                    |
| AC-9  | Submit after review                                                          | Questions appear in bank with status `PENDING`                               |
| AC-10 | LOCAL provider selected before Local LLM is configured                       | Setup banner displayed, no crash                                             |
| AC-11 | Verify no cloud API call is made                                             | DevTools Network: no request to `api.anthropic.com` / `api.openai.com`      |
| AC-12 | Verify no `QuestionGenerationJob` record is created                          | No new entry in `/api/v1/ai-questions/history`                               |

---

## 10. Risks & Mitigations

| Risk                                       | Severity       | Mitigation                                                                                                    |
| ------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------- |
| CORS blocked browser → self-hosted LLM     | **High**       | UI guides CORS configuration per server type; Test Connection diagnoses accurately; inline docs               |
| Poor JSON output from small models (7B/8B) | **High**       | 6-step repair pipeline; Zod validation; mandatory human review; default `quality_score = 0.7` → PENDING       |
| Mixed content HTTPS app → HTTP localhost   | **Medium**     | Chrome/Firefox/Edge OK with localhost (potentially trustworthy); Safari needs additional testing and guidance |
| LM Studio only lists loaded models         | **Low–Medium** | Clear UI note; guide users to load a model first                                                             |
| Cloud API key accidentally saved in localStorage | **Low**   | UI warning; field labeled "optional, local auth only"                                                        |
| Anthropic-compat proxy has limited server support | **Low** | Marked "(Advanced)"; defaults to OpenAI-compat; not prioritized in demos/docs                               |
| SSRF from browser — arbitrary URL          | **Low**        | localhost/loopback allowlist validation before fetch                                                         |

---

_This document tracks the design for feature US-XXXX — Local LLM Question Generation.
Update when design changes or after sprint review._
