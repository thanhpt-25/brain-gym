import type { LocalLlmDialect } from "./types";

const STORAGE_KEY = "braingym:local-llm-configs";
const LEGACY_STORAGE_KEY = "braingym:local-llm-config";

export interface StoredLocalLlmConfig {
  id: string;
  label?: string;
  dialect: LocalLlmDialect;
  baseUrl: string;
  modelId: string;
  apiKey?: string;
  savedAt: string; // ISO 8601
}

interface ConfigStore {
  configs: StoredLocalLlmConfig[];
  activeId: string | null;
}

/** Fields a caller provides when saving; id/savedAt are managed internally. */
export type LocalLlmConfigInput = Omit<
  StoredLocalLlmConfig,
  "id" | "savedAt"
> & {
  id?: string;
};

const EMPTY_STORE: ConfigStore = { configs: [], activeId: null };

function generateId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `cfg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Migrate a single legacy config (`braingym:local-llm-config`) into the new
 * multi-config store. Returns the migrated store, or null if nothing to migrate.
 */
function migrateLegacy(): ConfigStore | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;

    const legacy = JSON.parse(raw) as Omit<
      StoredLocalLlmConfig,
      "id" | "label"
    >;
    if (!legacy?.modelId || !legacy?.baseUrl) return null;

    const migrated: StoredLocalLlmConfig = {
      id: generateId(),
      dialect: legacy.dialect,
      baseUrl: legacy.baseUrl,
      modelId: legacy.modelId,
      apiKey: legacy.apiKey,
      savedAt: legacy.savedAt ?? new Date().toISOString(),
    };
    const store: ConfigStore = { configs: [migrated], activeId: migrated.id };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return store;
  } catch {
    return null;
  }
}

function read(): ConfigStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return migrateLegacy() ?? { ...EMPTY_STORE };
    }
    const parsed = JSON.parse(raw) as ConfigStore;
    if (!parsed || !Array.isArray(parsed.configs)) return { ...EMPTY_STORE };
    return {
      configs: parsed.configs,
      activeId: parsed.activeId ?? parsed.configs[0]?.id ?? null,
    };
  } catch {
    return { ...EMPTY_STORE };
  }
}

function write(store: ConfigStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/**
 * Two configs are considered the same profile when dialect + baseUrl + modelId
 * all match — saving the same model from the same endpoint updates it in place
 * rather than creating a duplicate.
 */
function isSameProfile(
  a: Pick<StoredLocalLlmConfig, "dialect" | "baseUrl" | "modelId">,
  b: Pick<StoredLocalLlmConfig, "dialect" | "baseUrl" | "modelId">,
): boolean {
  return (
    a.dialect === b.dialect &&
    a.baseUrl === b.baseUrl &&
    a.modelId === b.modelId
  );
}

export const localLlmConfigStorage = {
  /** All saved local LLM profiles, newest first. */
  list(): StoredLocalLlmConfig[] {
    return read().configs;
  },

  /** The currently active profile, or null if none are saved. */
  getActive(): StoredLocalLlmConfig | null {
    const { configs, activeId } = read();
    if (configs.length === 0) return null;
    return configs.find((c) => c.id === activeId) ?? configs[0];
  },

  getById(id: string): StoredLocalLlmConfig | null {
    return read().configs.find((c) => c.id === id) ?? null;
  },

  /**
   * Add a new profile or update an existing one (matched by id, otherwise by
   * dialect + baseUrl + modelId). The saved profile becomes active.
   * When updating, optional fields (`label`, `apiKey`) omitted from the input
   * keep their existing values rather than being wiped. Returns the persisted
   * profile.
   */
  save(input: LocalLlmConfigInput): StoredLocalLlmConfig {
    const store = read();
    const now = new Date().toISOString();

    const existingIndex = store.configs.findIndex((c) =>
      input.id ? c.id === input.id : isSameProfile(c, input),
    );
    const existing =
      existingIndex >= 0 ? store.configs[existingIndex] : undefined;

    const saved: StoredLocalLlmConfig = {
      id: input.id ?? existing?.id ?? generateId(),
      label: input.label ?? existing?.label,
      dialect: input.dialect,
      baseUrl: input.baseUrl,
      modelId: input.modelId,
      apiKey: input.apiKey ?? existing?.apiKey,
      savedAt: now,
    };

    const configs =
      existingIndex >= 0
        ? store.configs.map((c, i) => (i === existingIndex ? saved : c))
        : [saved, ...store.configs];

    write({ configs, activeId: saved.id });
    return saved;
  },

  setActive(id: string): void {
    const store = read();
    if (!store.configs.some((c) => c.id === id)) return;
    write({ ...store, activeId: id });
  },

  /** Remove a single profile. Reassigns the active pointer if needed. */
  remove(id: string): void {
    const store = read();
    const configs = store.configs.filter((c) => c.id !== id);
    const activeId =
      store.activeId === id ? (configs[0]?.id ?? null) : store.activeId;
    write({ configs, activeId });
  },

  /** Remove every saved profile. */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  },

  // ─── Legacy single-config API (kept for backward compatibility) ──────────────

  /** @deprecated Use `getActive()`. Returns the active profile. */
  get(): StoredLocalLlmConfig | null {
    return this.getActive();
  },

  /** @deprecated Use `save()`. Upserts a profile and marks it active. */
  set(config: LocalLlmConfigInput): void {
    this.save(config);
  },
};
