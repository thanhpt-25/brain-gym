import type { LocalLlmDialect } from "./types";

const STORAGE_KEY = "braingym:local-llm-config";

export interface StoredLocalLlmConfig {
  dialect: LocalLlmDialect;
  baseUrl: string;
  modelId: string;
  apiKey?: string;
  savedAt: string; // ISO 8601
}

export const localLlmConfigStorage = {
  get(): StoredLocalLlmConfig | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredLocalLlmConfig) : null;
    } catch {
      return null;
    }
  },

  set(config: Omit<StoredLocalLlmConfig, "savedAt">): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...config, savedAt: new Date().toISOString() }),
    );
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
