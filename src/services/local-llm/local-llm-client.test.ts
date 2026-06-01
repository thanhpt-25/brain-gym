import { describe, it, expect } from "vitest";
import { isAllowedLocalUrl } from "./local-llm-client";

describe("isAllowedLocalUrl", () => {
  // Localhost variants
  it("allows localhost", () => {
    expect(isAllowedLocalUrl("http://localhost:11434")).toBe(true);
    expect(isAllowedLocalUrl("http://localhost:1234/v1")).toBe(true);
  });

  it("allows 127.0.0.1", () => {
    expect(isAllowedLocalUrl("http://127.0.0.1:11434")).toBe(true);
    expect(isAllowedLocalUrl("http://127.255.255.255")).toBe(true);
  });

  it("allows ::1 IPv6 loopback", () => {
    expect(isAllowedLocalUrl("http://[::1]:8080")).toBe(true);
    // Note: IPv6 without brackets is invalid URL syntax; URL constructor requires [::1]
  });

  // .local domains (mDNS)
  it("allows .local domains", () => {
    expect(isAllowedLocalUrl("http://gpu-box.local:8080")).toBe(true);
    expect(isAllowedLocalUrl("http://myserver.local")).toBe(true);
    expect(isAllowedLocalUrl("http://deep.nested.local")).toBe(true);
  });

  // RFC 1918 private ranges
  it("allows RFC 1918 range 10.0.0.0 – 10.255.255.255", () => {
    expect(isAllowedLocalUrl("http://10.0.0.1")).toBe(true);
    expect(isAllowedLocalUrl("http://10.255.255.255")).toBe(true);
    expect(isAllowedLocalUrl("http://10.1.2.3:3000")).toBe(true);
  });

  it("allows RFC 1918 range 172.16.0.0 – 172.31.255.255", () => {
    expect(isAllowedLocalUrl("http://172.16.0.1")).toBe(true);
    expect(isAllowedLocalUrl("http://172.31.255.255")).toBe(true);
    expect(isAllowedLocalUrl("http://172.20.1.5")).toBe(true);
  });

  it("allows RFC 1918 range 192.168.0.0 – 192.168.255.255", () => {
    expect(isAllowedLocalUrl("http://192.168.1.1")).toBe(true);
    expect(isAllowedLocalUrl("http://192.168.255.255")).toBe(true);
    expect(isAllowedLocalUrl("http://192.168.0.100:5000")).toBe(true);
  });

  it("rejects 172.15.x.x (outside the 172.16-31 range)", () => {
    expect(isAllowedLocalUrl("http://172.15.0.1")).toBe(false);
    expect(isAllowedLocalUrl("http://172.32.0.1")).toBe(false);
  });

  // Link-local IPv6 and Unique Local IPv6
  it("allows link-local IPv6 (fe80::)", () => {
    expect(isAllowedLocalUrl("http://[fe80::1]")).toBe(true);
    expect(isAllowedLocalUrl("http://[fe80::1234:5678]")).toBe(true);
  });

  it("allows Unique Local IPv6 (fc00::)", () => {
    expect(isAllowedLocalUrl("http://[fc00::1]")).toBe(true);
    expect(isAllowedLocalUrl("http://[fc00::1234:5678]")).toBe(true);
  });

  // Public/external addresses (should reject)
  it("rejects public internet addresses", () => {
    expect(isAllowedLocalUrl("http://google.com")).toBe(false);
    expect(isAllowedLocalUrl("http://8.8.8.8")).toBe(false);
    expect(isAllowedLocalUrl("http://1.1.1.1:443")).toBe(false);
  });

  it("rejects 172.15.x.x and 192.167.x.x (edge cases)", () => {
    expect(isAllowedLocalUrl("http://172.15.255.255")).toBe(false);
    expect(isAllowedLocalUrl("http://192.167.255.255")).toBe(false);
  });

  // Invalid URLs
  it("returns false for invalid URLs", () => {
    expect(isAllowedLocalUrl("not a url")).toBe(false);
    expect(isAllowedLocalUrl("")).toBe(false);
    expect(isAllowedLocalUrl("just-text")).toBe(false);
  });
});
