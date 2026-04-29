import DOMPurify from "dompurify";

// Config for educational content: allow headings, lists, code, links
const PURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "s",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "a",
    "img",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "hr",
    "span",
    "div",
  ],
  ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "target", "rel"],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
};

/**
 * Sanitize HTML string from AI/user content before rendering.
 * Use with dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") {
    // SSR fallback — strip all tags
    return html.replace(/<[^>]*>/g, "");
  }
  return DOMPurify.sanitize(html, PURIFY_CONFIG) as string;
}

/**
 * Test helper: check if content would be sanitized
 */
export function wouldSanitize(html: string): boolean {
  const sanitized = sanitizeHtml(html);
  return sanitized !== html;
}
