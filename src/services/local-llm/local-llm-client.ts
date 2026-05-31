import {
  Difficulty,
  GeneratedQuestionPreview,
  QualityTier,
  QuestionType,
} from "@/types/api-types";
import { buildLocalSystemPrompt, buildLocalUserPrompt } from "./prompt-builder";
import { RawQuestionsResponseSchema, type RawQuestion } from "./schema";
import type {
  ConnectionTestResult,
  LocalGenerationParams,
  LocalLlmConfig,
  LocalModelInfo,
} from "./types";

// ─── URL safety ──────────────────────────────────────────────────────────────

export function isAllowedLocalUrl(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

// ─── Auth headers per dialect ─────────────────────────────────────────────────

function authHeaders(config: LocalLlmConfig): Record<string, string> {
  switch (config.dialect) {
    case "anthropic":
      return {
        "x-api-key": config.apiKey ?? "",
        "anthropic-version": "2023-06-01",
      };
    case "openai":
      // Ollama accepts any non-empty Bearer; LM Studio may require one too.
      return { Authorization: `Bearer ${config.apiKey || "local"}` };
    case "ollama":
      return {};
  }
}

// ─── Model discovery ──────────────────────────────────────────────────────────

async function parseOpenAiModels(res: Response): Promise<LocalModelInfo[]> {
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((m) => ({ id: m.id, name: m.id }));
}

async function parseOllamaModels(res: Response): Promise<LocalModelInfo[]> {
  const data = (await res.json()) as {
    models?: { name: string; model?: string }[];
  };
  return (data.models ?? []).map((m) => ({
    id: m.model ?? m.name,
    name: m.name,
  }));
}

/** Distinguish CORS-blocked from truly unreachable using a no-cors probe. */
async function detectNetworkError(
  baseUrl: string,
): Promise<"cors" | "unreachable"> {
  try {
    await fetch(baseUrl, {
      method: "HEAD",
      mode: "no-cors",
      signal: AbortSignal.timeout(3000),
    });
    // Got an opaque response → server is reachable, real request was CORS-blocked.
    return "cors";
  } catch {
    return "unreachable";
  }
}

/** Ollama fallback: if /models returns 404, retry with /api/tags. */
async function testOllamaFallback(
  config: Omit<LocalLlmConfig, "modelId">,
): Promise<ConnectionTestResult> {
  try {
    const res = await fetch(`${config.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: "wrong_dialect",
        hint: "Endpoint not found. Check the base URL and dialect.",
      };
    }
    const models = await parseOllamaModels(res);
    if (models.length === 0) {
      return {
        ok: false,
        reason: "empty",
        hint: "Ollama is running but no models are loaded. Run: ollama pull <model>",
      };
    }
    return { ok: true, models };
  } catch {
    const reason = await detectNetworkError(config.baseUrl);
    return {
      ok: false,
      reason,
      hint:
        reason === "cors"
          ? "CORS is blocking the request. Set OLLAMA_ORIGINS to include this page's origin."
          : `Cannot reach ${config.baseUrl}. Make sure Ollama is running.`,
    };
  }
}

export async function testConnection(
  config: Omit<LocalLlmConfig, "modelId">,
): Promise<ConnectionTestResult> {
  if (!isAllowedLocalUrl(config.baseUrl)) {
    return {
      ok: false,
      reason: "unreachable",
      hint: "Base URL must point to localhost or a .local host.",
    };
  }

  const { dialect, baseUrl } = config;
  const listUrl =
    dialect === "ollama" ? `${baseUrl}/api/tags` : `${baseUrl}/models`;

  try {
    const res = await fetch(listUrl, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders({ ...config, modelId: "" }),
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      if (res.status === 404 && dialect === "openai") {
        return testOllamaFallback(config);
      }
      return {
        ok: false,
        reason: "wrong_dialect",
        hint: `Server returned ${res.status}. Try switching to a different dialect.`,
      };
    }

    const models =
      dialect === "ollama"
        ? await parseOllamaModels(res)
        : await parseOpenAiModels(res);

    if (models.length === 0) {
      return {
        ok: false,
        reason: "empty",
        hint:
          dialect === "openai"
            ? "No models found. Make sure a model is loaded in LM Studio, or start Ollama with a model pulled."
            : "No models returned by the server.",
      };
    }

    return { ok: true, models };
  } catch {
    const reason = await detectNetworkError(baseUrl);
    const hint =
      reason === "cors"
        ? `CORS is blocking the request. For Ollama: set OLLAMA_ORIGINS to include this page's origin. For LM Studio: enable CORS in Settings → Local Server.`
        : `Cannot reach ${baseUrl}. Make sure the server is running.`;
    return { ok: false, reason, hint };
  }
}

export async function listModels(
  config: LocalLlmConfig,
): Promise<LocalModelInfo[]> {
  const result = await testConnection(config);
  return result.ok ? result.models : [];
}

// ─── Generation ───────────────────────────────────────────────────────────────

async function callGenerate(
  config: LocalLlmConfig,
  system: string,
  user: string,
): Promise<string> {
  const headers = {
    "Content-Type": "application/json",
    ...authHeaders(config),
  };
  const timeout = AbortSignal.timeout(120_000);

  if (config.dialect === "ollama") {
    const res = await fetch(`${config.baseUrl}/api/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.modelId,
        prompt: `${system}\n\n${user}`,
        stream: false,
      }),
      signal: timeout,
    });
    const data = (await res.json()) as { response: string };
    return data.response ?? "";
  }

  if (config.dialect === "anthropic") {
    const res = await fetch(`${config.baseUrl}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.modelId,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: timeout,
    });
    const data = (await res.json()) as { content: { text: string }[] };
    return data.content?.[0]?.text ?? "";
  }

  // openai dialect — also covers Ollama /v1
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.modelId,
      max_tokens: 4096,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: timeout,
  });
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── JSON extraction pipeline ─────────────────────────────────────────────────

function extractJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // continue
  }
  const fence = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      // continue
    }
  }
  // Find first balanced { }
  const start = raw.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === "{") depth++;
      else if (raw[i] === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(raw.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function confidenceToScore(hint: string): number {
  if (hint === "high") return 0.87;
  if (hint === "low") return 0.5;
  return 0.7;
}

function scoreToTier(score: number): QualityTier | null {
  if (score >= 0.8) return "HIGH";
  if (score >= 0.5) return "MEDIUM";
  return "LOW";
}

function mapRawToPreview(
  raw: RawQuestion,
  params: LocalGenerationParams,
): GeneratedQuestionPreview {
  const correctLetters = raw.correct_answer
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const choices = raw.options.map((opt, idx) => {
    const label =
      opt.match(/^\s*([A-Z])\b/)?.[1] ?? String.fromCharCode(65 + idx);
    const content = opt.replace(/^\s*[A-Z][.)]\s*/, "").trim();
    return { label, content, isCorrect: correctLetters.includes(label) };
  });

  const score = confidenceToScore(raw.confidence_hint ?? "medium");
  const questionType =
    correctLetters.length > 1 ? QuestionType.MULTIPLE : QuestionType.SINGLE;

  return {
    title: raw.question,
    questionType,
    difficulty: params.difficulty as Difficulty,
    explanation: raw.explanation ?? "",
    choices,
    tags: [],
    sourcePassage: raw.source_passage,
    qualityScore: score,
    qualityTier: scoreToTier(score),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GenerateLocalResult {
  previews: GeneratedQuestionPreview[];
  discarded: number;
  /** Populated when all questions were discarded, for debugging. */
  rawText?: string;
}

export async function generateLocalQuestions(
  config: LocalLlmConfig,
  params: LocalGenerationParams,
): Promise<GenerateLocalResult> {
  const system = buildLocalSystemPrompt();
  const user = buildLocalUserPrompt(params);
  const rawText = await callGenerate(config, system, user);
  const parsed = extractJson(rawText);

  if (!parsed) {
    return { previews: [], discarded: params.questionCount, rawText };
  }

  const result = RawQuestionsResponseSchema.safeParse(parsed);
  if (!result.success) {
    // Salvage valid individual questions
    const arr = Array.isArray((parsed as any)?.questions)
      ? (parsed as any).questions
      : Array.isArray(parsed)
        ? parsed
        : [];

    const previews: GeneratedQuestionPreview[] = [];
    for (const item of arr) {
      const q =
        RawQuestionsResponseSchema.shape.questions.element.safeParse(item);
      if (q.success) previews.push(mapRawToPreview(q.data, params));
    }
    return {
      previews,
      discarded: params.questionCount - previews.length,
      rawText: previews.length === 0 ? rawText : undefined,
    };
  }

  return {
    previews: result.data.questions.map((q) => mapRawToPreview(q, params)),
    discarded: 0,
  };
}
