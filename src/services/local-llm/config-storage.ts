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

/**
 * Shape actually written to localStorage. The apiKey is deliberately NOT
 * persisted (see `apiKeyCache`) to avoid storing a secret in clear text.
 */
type PersistedConfig = Omit<StoredLocalLlmConfig, "apiKey">;

interface ConfigStore {
  configs: PersistedConfig[];
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

/**
 * Session-scoped, in-memory store for API keys, keyed by config id. Keys are
 * never written to localStorage, so they are cleared on reload — for endpoints
 * that need a key the user re-enters it per session (most local servers need
 * none). This is what keeps the secret out of clear-text persistent storage.
 */
const apiKeyCache = new Map<string, string>();

function generateId(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const hex = Array.from(bytes, (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      return `cfg-${hex}`;
    }
  }
  // Last-resort fallback: ids are local identifiers, not a security token.
  return `cfg-${Date.now()}-${performance.now().toString(36).replace(".", "")}`;
}

/** Attach the session-cached apiKey (if any) to a persisted config. */
function hydrate(config: PersistedConfig): StoredLocalLlmConfig {
  const apiKey = apiKeyCache.get(config.id);
  return apiKey ? { ...config, apiKey } : { ...config };
}

/**
 * Drop the apiKey before persisting. If a key is present (e.g. legacy data or
 * an upgraded store written by an earlier version) it is moved into the
 * in-memory cache so it still works for the current session.
 */
function toPersisted(
  config: PersistedConfig & { apiKey?: string },
): PersistedConfig {
  const { apiKey, ...rest } = config;
  if (apiKey) apiKeyCache.set(rest.id, apiKey);
  return rest;
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

    const id = generateId();
    if (legacy.apiKey) apiKeyCache.set(id, legacy.apiKey);

    const migrated: PersistedConfig = {
      id,
      dialect: legacy.dialect,
      baseUrl: legacy.baseUrl,
      modelId: legacy.modelId,
      savedAt: legacy.savedAt ?? new Date().toISOString(),
    };
    const store: ConfigStore = { configs: [migrated], activeId: id };
    write(store);
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
    const parsed = JSON.parse(raw) as {
      configs?: (PersistedConfig & { apiKey?: string })[];
      activeId?: string | null;
    };
    if (!parsed || !Array.isArray(parsed.configs)) return { ...EMPTY_STORE };
    // Defensively strip any persisted apiKey (and move it to the cache).
    const configs = parsed.configs.map(toPersisted);
    return {
      configs,
      activeId: parsed.activeId ?? configs[0]?.id ?? null,
    };
  } catch {
    return { ...EMPTY_STORE };
  }
}

function write(store: ConfigStore): void {
  // Re-strip on the way out so a secret can never reach localStorage.
  const safe: ConfigStore = {
    configs: store.configs.map(toPersisted),
    activeId: store.activeId,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
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
    return read().configs.map(hydrate);
  },

  /** The currently active profile, or null if none are saved. */
  getActive(): StoredLocalLlmConfig | null {
    const { configs, activeId } = read();
    if (configs.length === 0) return null;
    const found = configs.find((c) => c.id === activeId) ?? configs[0];
    return hydrate(found);
  },

  getById(id: string): StoredLocalLlmConfig | null {
    const found = read().configs.find((c) => c.id === id);
    return found ? hydrate(found) : null;
  },

  /**
   * Add a new profile or update an existing one (matched by id, otherwise by
   * dialect + baseUrl + modelId). The saved profile becomes active.
   * When updating, the optional `label` omitted from the input keeps its
   * existing value. The apiKey is held in memory for the session only and is
   * preserved across updates that omit it. Returns the saved profile.
   */
  save(input: LocalLlmConfigInput): StoredLocalLlmConfig {
    const store = read();
    const now = new Date().toISOString();

    const existingIndex = store.configs.findIndex((c) =>
      input.id ? c.id === input.id : isSameProfile(c, input),
    );
    const existing =
      existingIndex >= 0 ? store.configs[existingIndex] : undefined;

    const id = input.id ?? existing?.id ?? generateId();

    const saved: PersistedConfig = {
      id,
      label: input.label ?? existing?.label,
      dialect: input.dialect,
      baseUrl: input.baseUrl,
      modelId: input.modelId,
      savedAt: now,
    };

    // Update the in-memory key cache: a provided non-empty key replaces it, an
    // explicit empty string clears it, and an omitted key is left untouched.
    if (input.apiKey !== undefined) {
      if (input.apiKey) apiKeyCache.set(id, input.apiKey);
      else apiKeyCache.delete(id);
    }

    const configs =
      existingIndex >= 0
        ? store.configs.map((c, i) => (i === existingIndex ? saved : c))
        : [saved, ...store.configs];

    write({ configs, activeId: id });
    return hydrate(saved);
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
    apiKeyCache.delete(id);
    write({ configs, activeId });
  },

  /** Remove every saved profile. */
  clear(): void {
    apiKeyCache.clear();
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
