import { describe, it, expect, vi, beforeEach } from "vitest";
import { isAllowedLocalUrl } from "@/services/local-llm/local-llm-client";
import { localLlmConfigStorage } from "@/services/local-llm/config-storage";
import { LocalLlmConfig } from "@/types/api-types";

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

    it("should reject external URLs", () => {
      expect(isAllowedLocalUrl("http://example.com:11434")).toBe(false);
      expect(isAllowedLocalUrl("https://api.openai.com")).toBe(false);
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

      // Check that localStorage was updated with the correct key
      const stored = localStorage.getItem("braingym:local-llm-config");
      expect(stored).toBeDefined();
      expect(stored).toContain("localhost:11434");
      expect(stored).toContain("test-model");
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
