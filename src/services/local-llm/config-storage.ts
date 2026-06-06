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
 * Shape written to localStorage. The apiKey IS persisted (in clear text) so it
 * survives page reloads — otherwise the key is lost on refresh and the next
 * generation request fails with 401. This is the same exposure level as the
 * auth JWT the app already keeps in localStorage; do not store high-value
 * secrets in a local LLM profile.
 */
type PersistedConfig = StoredLocalLlmConfig;

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

/** Return a defensive copy of a stored config. */
function clone(config: PersistedConfig): StoredLocalLlmConfig {
  return { ...config };
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
    const migrated: PersistedConfig = {
      id,
      dialect: legacy.dialect,
      baseUrl: legacy.baseUrl,
      modelId: legacy.modelId,
      ...(legacy.apiKey ? { apiKey: legacy.apiKey } : {}),
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
      configs?: PersistedConfig[];
      activeId?: string | null;
    };
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
    return read().configs.map(clone);
  },

  /** The currently active profile, or null if none are saved. */
  getActive(): StoredLocalLlmConfig | null {
    const { configs, activeId } = read();
    if (configs.length === 0) return null;
    const found = configs.find((c) => c.id === activeId) ?? configs[0];
    return clone(found);
  },

  getById(id: string): StoredLocalLlmConfig | null {
    const found = read().configs.find((c) => c.id === id);
    return found ? clone(found) : null;
  },

  /**
   * Add a new profile or update an existing one (matched by id, otherwise by
   * dialect + baseUrl + modelId). The saved profile becomes active.
   * When updating, an omitted `label` or `apiKey` keeps its existing value; an
   * explicit empty-string `apiKey` clears it. Returns the saved profile.
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

    // Resolve the key: a provided non-empty key replaces it, an explicit empty
    // string clears it, and an omitted key keeps the existing one.
    const apiKey =
      input.apiKey !== undefined ? input.apiKey || undefined : existing?.apiKey;

    const saved: PersistedConfig = {
      id,
      label: input.label ?? existing?.label,
      dialect: input.dialect,
      baseUrl: input.baseUrl,
      modelId: input.modelId,
      ...(apiKey ? { apiKey } : {}),
      savedAt: now,
    };

    const configs =
      existingIndex >= 0
        ? store.configs.map((c, i) => (i === existingIndex ? saved : c))
        : [saved, ...store.configs];

    write({ configs, activeId: id });
    return clone(saved);
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
