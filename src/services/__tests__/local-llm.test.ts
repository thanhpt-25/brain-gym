import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isAllowedLocalUrl,
  isCloudProviderUrl,
} from "@/services/local-llm/local-llm-client";
import { localLlmConfigStorage } from "@/services/local-llm/config-storage";
import { LocalLlmConfig } from "@/services/local-llm/types";

describe("Local LLM Feature", () => {
  describe("URL Validation", () => {
    it("should allow localhost URLs", () => {
      expect(isAllowedLocalUrl("http://localhost:11434")).toBe(true);
      expect(isAllowedLocalUrl("http://localhost:8000")).toBe(true);
    });

    it("should allow 127.0.0.1 URLs", () => {
      expect(isAllowedLocalUrl("http://127.0.0.1:11434")).toBe(true);
    });

    it("should allow IPv6 localhost URLs", () => {
      expect(isAllowedLocalUrl("http://[::1]:11434")).toBe(true);
    });

    it("should allow .local domain names", () => {
      expect(isAllowedLocalUrl("http://ollama.local:11434")).toBe(true);
      expect(isAllowedLocalUrl("http://lm-studio.local:8000")).toBe(true);
    });

    it("should accept any valid http/https URL (external endpoints now supported)", () => {
      // isAllowedLocalUrl is now an alias for isValidLlmUrl — accepts any http/https URL
      // including VPC endpoints, custom domain servers, etc.
      expect(isAllowedLocalUrl("http://example.com:11434")).toBe(true);
      expect(isAllowedLocalUrl("https://llm.mycompany.com/v1")).toBe(true);
    });

    it("should warn about official cloud provider URLs via isCloudProviderUrl", () => {
      expect(isCloudProviderUrl("https://api.openai.com")).toBe(true);
      expect(isCloudProviderUrl("https://api.anthropic.com")).toBe(true);
      // Custom / self-hosted endpoints are not flagged
      expect(isCloudProviderUrl("http://example.com:11434")).toBe(false);
      expect(isCloudProviderUrl("http://localhost:11434")).toBe(false);
    });

    it("should handle invalid URLs gracefully", () => {
      expect(isAllowedLocalUrl("not a valid url")).toBe(false);
      expect(isAllowedLocalUrl("")).toBe(false);
    });
  });

  describe("Config Storage", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("should save and retrieve config", () => {
      const config: LocalLlmConfig = {
        dialect: "openai",
        baseUrl: "http://localhost:11434",
        modelId: "llama2",
        apiKey: "test-key",
      };

      localLlmConfigStorage.set(config);
      const retrieved = localLlmConfigStorage.get();

      expect(retrieved).toBeDefined();
      expect(retrieved?.dialect).toBe("openai");
      expect(retrieved?.baseUrl).toBe("http://localhost:11434");
      expect(retrieved?.modelId).toBe("llama2");
    });

    it("should return null when no config is saved", () => {
      const retrieved = localLlmConfigStorage.get();
      expect(retrieved).toBeNull();
    });

    it("should clear config", () => {
      const config: LocalLlmConfig = {
        dialect: "ollama",
        baseUrl: "http://localhost:11434",
        modelId: "mistral",
      };

      localLlmConfigStorage.set(config);
      expect(localLlmConfigStorage.get()).toBeDefined();

      localLlmConfigStorage.clear();
      expect(localLlmConfigStorage.get()).toBeNull();
    });

    it("should update existing config", () => {
      const config1: LocalLlmConfig = {
        dialect: "openai",
        baseUrl: "http://localhost:11434",
        modelId: "llama2",
      };

      localLlmConfigStorage.set(config1);

      const config2: LocalLlmConfig = {
        dialect: "anthropic",
        baseUrl: "http://localhost:8000",
        modelId: "claude-3",
      };

      localLlmConfigStorage.set(config2);
      const retrieved = localLlmConfigStorage.get();

      expect(retrieved?.dialect).toBe("anthropic");
      expect(retrieved?.baseUrl).toBe("http://localhost:8000");
      expect(retrieved?.modelId).toBe("claude-3");
    });

    it("should handle apiKey field optionally", () => {
      const configWithoutKey: LocalLlmConfig = {
        dialect: "ollama",
        baseUrl: "http://localhost:11434",
        modelId: "llama2",
      };

      localLlmConfigStorage.set(configWithoutKey);
      const retrieved = localLlmConfigStorage.get();

      expect(retrieved).toBeDefined();
      expect(retrieved?.apiKey).toBeUndefined();
    });

    it("should validate storage key format", () => {
      // Verify that the storage key is consistent
      const config: LocalLlmConfig = {
        dialect: "openai",
        baseUrl: "http://localhost:11434",
        modelId: "test-model",
      };

      localLlmConfigStorage.set(config);

      // Check that localStorage was updated with the correct (multi-config) key
      const stored = localStorage.getItem("braingym:local-llm-configs");
      expect(stored).toBeTruthy();
      expect(stored).toContain("localhost:11434");
      expect(stored).toContain("test-model");
    });
  });

  describe("Multi-Config Storage", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("should store multiple profiles and list them", () => {
      localLlmConfigStorage.save({
        dialect: "openai",
        baseUrl: "http://localhost:11434/v1",
        modelId: "llama3",
        label: "Llama 3",
      });
      localLlmConfigStorage.save({
        dialect: "openai",
        baseUrl: "http://localhost:11434/v1",
        modelId: "mistral",
      });

      const list = localLlmConfigStorage.list();
      expect(list).toHaveLength(2);
      expect(list.map((c) => c.modelId).sort()).toEqual(["llama3", "mistral"]);
    });

    it("should not duplicate the same dialect+baseUrl+modelId profile", () => {
      localLlmConfigStorage.save({
        dialect: "openai",
        baseUrl: "http://localhost:11434/v1",
        modelId: "llama3",
      });
      localLlmConfigStorage.save({
        dialect: "openai",
        baseUrl: "http://localhost:11434/v1",
        modelId: "llama3",
        label: "renamed",
      });

      const list = localLlmConfigStorage.list();
      expect(list).toHaveLength(1);
      expect(list[0].label).toBe("renamed");
    });

    it("should preserve label/apiKey when an id update omits them", () => {
      const saved = localLlmConfigStorage.save({
        dialect: "openai",
        baseUrl: "http://localhost:11434/v1",
        modelId: "llama3",
        label: "My Llama",
        apiKey: "secret",
      });

      // Update by id without passing label/apiKey — they must not be wiped.
      localLlmConfigStorage.save({
        id: saved.id,
        dialect: "openai",
        baseUrl: "http://localhost:11434/v1",
        modelId: "llama3",
      });

      const updated = localLlmConfigStorage.getById(saved.id);
      expect(updated?.label).toBe("My Llama");
      expect(updated?.apiKey).toBe("secret");
    });

    it("should persist the apiKey so it survives a reload", () => {
      const saved = localLlmConfigStorage.save({
        dialect: "openai",
        baseUrl: "http://localhost:11434/v1",
        modelId: "llama3",
        apiKey: "super-secret-key",
      });

      // The key is persisted to localStorage so it survives a page reload —
      // otherwise the next generation request would fail with 401.
      const raw = localStorage.getItem("braingym:local-llm-configs") ?? "";
      expect(raw).toContain("super-secret-key");

      // A fresh read (simulating a reload) still yields the key.
      expect(localLlmConfigStorage.getById(saved.id)?.apiKey).toBe(
        "super-secret-key",
      );
    });

    it("should mark the most recently saved profile active", () => {
      localLlmConfigStorage.save({
        dialect: "openai",
        baseUrl: "http://localhost:11434/v1",
        modelId: "llama3",
      });
      const second = localLlmConfigStorage.save({
        dialect: "ollama",
        baseUrl: "http://localhost:11434",
        modelId: "mistral",
      });

      expect(localLlmConfigStorage.getActive()?.id).toBe(second.id);
    });

    it("should switch the active profile via setActive", () => {
      const first = localLlmConfigStorage.save({
        dialect: "openai",
        baseUrl: "http://localhost:11434/v1",
        modelId: "llama3",
      });
      localLlmConfigStorage.save({
        dialect: "ollama",
        baseUrl: "http://localhost:11434",
        modelId: "mistral",
      });

      localLlmConfigStorage.setActive(first.id);
      expect(localLlmConfigStorage.getActive()?.modelId).toBe("llama3");
    });

    it("should remove one profile and reassign active when needed", () => {
      const first = localLlmConfigStorage.save({
        dialect: "openai",
        baseUrl: "http://localhost:11434/v1",
        modelId: "llama3",
      });
      const second = localLlmConfigStorage.save({
        dialect: "ollama",
        baseUrl: "http://localhost:11434",
        modelId: "mistral",
      });

      // `second` is active; removing it should fall back to `first`.
      localLlmConfigStorage.remove(second.id);
      expect(localLlmConfigStorage.list()).toHaveLength(1);
      expect(localLlmConfigStorage.getActive()?.id).toBe(first.id);
    });

    it("should migrate a legacy single-config entry into the new store", () => {
      localStorage.setItem(
        "braingym:local-llm-config",
        JSON.stringify({
          dialect: "ollama",
          baseUrl: "http://localhost:11434",
          modelId: "legacy-model",
          savedAt: "2026-01-01T00:00:00.000Z",
        }),
      );

      const list = localLlmConfigStorage.list();
      expect(list).toHaveLength(1);
      expect(list[0].modelId).toBe("legacy-model");
      expect(list[0].id).toBeTruthy();
      // Legacy key is cleared after migration.
      expect(localStorage.getItem("braingym:local-llm-config")).toBeNull();
      expect(localLlmConfigStorage.getActive()?.modelId).toBe("legacy-model");
    });
  });

  describe("Feature Integration", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("should support openai dialect configuration", () => {
      const config: LocalLlmConfig = {
        dialect: "openai",
        baseUrl: "http://localhost:8000",
        modelId: "any-openai-compatible-model",
      };

      localLlmConfigStorage.set(config);
      const retrieved = localLlmConfigStorage.get();

      expect(retrieved?.dialect).toBe("openai");
    });

    it("should support anthropic dialect configuration", () => {
      const config: LocalLlmConfig = {
        dialect: "anthropic",
        baseUrl: "http://localhost:8000",
        modelId: "claude-compatible-model",
      };

      localLlmConfigStorage.set(config);
      const retrieved = localLlmConfigStorage.get();

      expect(retrieved?.dialect).toBe("anthropic");
    });

    it("should support ollama dialect configuration", () => {
      const config: LocalLlmConfig = {
        dialect: "ollama",
        baseUrl: "http://localhost:11434",
        modelId: "llama2",
      };

      localLlmConfigStorage.set(config);
      const retrieved = localLlmConfigStorage.get();

      expect(retrieved?.dialect).toBe("ollama");
    });

    it("should persist config across multiple save/load cycles", () => {
      const configs: LocalLlmConfig[] = [
        {
          dialect: "openai",
          baseUrl: "http://localhost:11434",
          modelId: "model1",
        },
        {
          dialect: "ollama",
          baseUrl: "http://localhost:11434",
          modelId: "model2",
        },
        {
          dialect: "anthropic",
          baseUrl: "http://localhost:8000",
          modelId: "model3",
        },
      ];

      configs.forEach((config) => {
        localLlmConfigStorage.set(config);
        const retrieved = localLlmConfigStorage.get();
        expect(retrieved?.modelId).toBe(config.modelId);
        expect(retrieved?.dialect).toBe(config.dialect);
      });
    });
  });
});
