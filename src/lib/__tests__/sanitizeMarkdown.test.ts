// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { sanitizeHtml, wouldSanitize } from "../sanitizeMarkdown";

describe("sanitizeHtml", () => {
  it("allows safe markdown HTML", () => {
    const safe = "<p>Hello <strong>world</strong></p>";
    expect(sanitizeHtml(safe)).toBe(safe);
  });

  it("strips script tags", () => {
    const xss = '<p>Hello</p><script>alert("xss")</script>';
    expect(sanitizeHtml(xss)).not.toContain("<script>");
  });

  it("strips event handlers", () => {
    const xss = '<img src="x" onerror="alert(1)">';
    expect(sanitizeHtml(xss)).not.toContain("onerror");
  });

  it("strips iframe", () => {
    const xss = '<iframe src="https://evil.com"></iframe>';
    expect(sanitizeHtml(xss)).not.toContain("iframe");
  });

  it("preserves code blocks", () => {
    const code =
      '<pre><code class="language-typescript">const x = 1</code></pre>';
    expect(sanitizeHtml(code)).toContain("<code");
  });

  it("preserves links", () => {
    const link = '<a href="https://aws.amazon.com">AWS</a>';
    expect(sanitizeHtml(link)).toContain("<a");
  });

  it("strips object tags", () => {
    const xss = '<object data="malicious.swf"></object>';
    expect(sanitizeHtml(xss)).not.toContain("<object");
  });

  it("strips form tags", () => {
    const xss = '<form action="https://evil.com"><input type="text"></form>';
    expect(sanitizeHtml(xss)).not.toContain("<form");
    expect(sanitizeHtml(xss)).not.toContain("<input");
  });
});

describe("wouldSanitize", () => {
  it("returns false for safe content", () => {
    const safe = "<p>Hello <strong>world</strong></p>";
    expect(wouldSanitize(safe)).toBe(false);
  });

  it("returns true for content with script tags", () => {
    const xss = '<p>Hello</p><script>alert("xss")</script>';
    expect(wouldSanitize(xss)).toBe(true);
  });

  it("returns true for content with event handlers", () => {
    const xss = '<img src="x" onerror="alert(1)">';
    expect(wouldSanitize(xss)).toBe(true);
  });
});
