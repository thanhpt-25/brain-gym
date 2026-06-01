import { describe, it, expect } from "vitest";
import { isValidLlmUrl, isCloudProviderUrl } from "./local-llm-client";

describe("isValidLlmUrl", () => {
  it("allows localhost", () => {
    expect(isValidLlmUrl("http://localhost:11434")).toBe(true);
    expect(isValidLlmUrl("http://localhost:1234/v1")).toBe(true);
    expect(isValidLlmUrl("https://localhost:8443")).toBe(true);
  });

  it("allows private network IPs (RFC 1918)", () => {
    expect(isValidLlmUrl("http://192.168.1.100:8080")).toBe(true);
    expect(isValidLlmUrl("http://10.0.0.5:11434")).toBe(true);
    expect(isValidLlmUrl("http://172.16.0.1:3000")).toBe(true);
  });

  it("allows .local mDNS domains", () => {
    expect(isValidLlmUrl("http://gpu-box.local:8080")).toBe(true);
    expect(isValidLlmUrl("http://myserver.local/v1")).toBe(true);
  });

  it("allows any public domain (VPC endpoint, custom server, etc.)", () => {
    expect(isValidLlmUrl("https://llm.mycompany.com/v1")).toBe(true);
    expect(isValidLlmUrl("https://inference.example.org:8080")).toBe(true);
    expect(isValidLlmUrl("http://203.0.113.42:8080")).toBe(true);
  });

  it("allows https scheme", () => {
    expect(isValidLlmUrl("https://ollama.internal/v1")).toBe(true);
  });

  it("rejects non-http schemes", () => {
    expect(isValidLlmUrl("ftp://example.com")).toBe(false);
    expect(isValidLlmUrl("ws://example.com")).toBe(false);
  });

  it("rejects invalid / empty URLs", () => {
    expect(isValidLlmUrl("not a url")).toBe(false);
    expect(isValidLlmUrl("")).toBe(false);
    expect(isValidLlmUrl("just-text")).toBe(false);
    expect(isValidLlmUrl("localhost:11434")).toBe(false); // missing scheme
  });
});

describe("isCloudProviderUrl", () => {
  it("detects known cloud API endpoints", () => {
    expect(isCloudProviderUrl("https://api.openai.com/v1")).toBe(true);
    expect(isCloudProviderUrl("https://api.anthropic.com/v1")).toBe(true);
    expect(isCloudProviderUrl("https://generativelanguage.googleapis.com")).toBe(true);
    expect(isCloudProviderUrl("https://api.cohere.com")).toBe(true);
    expect(isCloudProviderUrl("https://api.mistral.ai/v1")).toBe(true);
  });

  it("does not flag custom / self-hosted endpoints", () => {
    expect(isCloudProviderUrl("http://localhost:11434")).toBe(false);
    expect(isCloudProviderUrl("http://192.168.1.1:8080")).toBe(false);
    expect(isCloudProviderUrl("https://llm.mycompany.com/v1")).toBe(false);
    expect(isCloudProviderUrl("https://gpu-box.local:8080")).toBe(false);
  });

  it("does not flag OpenAI-compatible servers that are not official", () => {
    expect(isCloudProviderUrl("https://openai-proxy.mycompany.com/v1")).toBe(false);
  });

  it("returns false for invalid URLs", () => {
    expect(isCloudProviderUrl("not a url")).toBe(false);
    expect(isCloudProviderUrl("")).toBe(false);
  });
});
