import React, { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { DomainMastery } from "../../services/mastery";

export interface DomainBreakdownDrawerProps {
  domains: DomainMastery[];
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement>;
}

/** Foreground color for the accuracy badge. */
function accuracyColor(accuracy: number): string {
  if (accuracy >= 70) return "var(--color-signal)";
  if (accuracy >= 50) return "var(--color-warn)";
  return "var(--color-danger)";
}

/** Semi-transparent background tint for the accuracy badge. */
function accuracyBgColor(accuracy: number): string {
  if (accuracy >= 70) return "oklch(72% 0.17 165 / 0.12)";
  if (accuracy >= 50) return "oklch(78% 0.16 75 / 0.12)";
  return "oklch(58% 0.22 25 / 0.12)";
}

/**
 * DomainBreakdownDrawer — right-side slide-in drawer
 *
 * a11y: role="dialog", aria-modal="true", aria-labelledby="drawer-title",
 *        focus-trapped, ESC to close, returns focus to trigger on close.
 * Motion: CSS transform translateX, respects prefers-reduced-motion via
 *         the global animation rule in tokens.css.
 * Design: Editorial light / dark luxury — intentional on both themes.
 */
export function DomainBreakdownDrawer({
  domains,
  isOpen,
  onClose,
  triggerRef,
}: DomainBreakdownDrawerProps) {
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Sort ascending by accuracy so weakest domains appear first
  const sortedDomains = [...domains].sort((a, b) => a.accuracy - b.accuracy);

  // ── Return focus & close ─────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    onClose();
    // Defer so React has flushed state before moving focus
    setTimeout(() => triggerRef.current?.focus(), 0);
  }, [onClose, triggerRef]);

  // ── Focus: move into drawer on open ─────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      const id = setTimeout(() => closeButtonRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [isOpen]);

  // ── ESC key ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return undefined;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  // ── Focus trap ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return undefined;

    function getFocusable(): HTMLElement[] {
      if (!drawerRef.current) return [];
      return Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  // ── Prevent body scroll while drawer is open ────────────────────────────

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ── Navigate to SRS practice ─────────────────────────────────────────────

  function handlePractice(domainId: string) {
    navigate(`/srs/today?domain=${domainId}`);
    handleClose();
  }

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 49,
          background: "oklch(14% 0.01 60 / 0.5)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity var(--duration-normal) var(--ease-out-expo)",
        }}
      />

      {/* ── Drawer panel ──────────────────────────────────────────────── */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          width: "min(480px, 100vw)",
          display: "flex",
          flexDirection: "column",
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-surface-2)",
          boxShadow: "-16px 0 48px oklch(14% 0.01 60 / 0.18)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform var(--duration-normal) var(--ease-out-expo)",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 1.5rem 1rem",
            borderBottom: "1px solid var(--color-surface-2)",
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              id="drawer-title"
              style={{
                margin: 0,
                fontSize: "var(--text-title)",
                fontWeight: 700,
                color: "var(--color-ink)",
                letterSpacing: "-0.02em",
              }}
            >
              Domain Breakdown
            </h2>
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "var(--text-sm)",
                color: "var(--color-ink-muted)",
              }}
            >
              Sorted by lowest accuracy first
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            aria-label="Close domain breakdown"
            style={{
              width: "2.25rem",
              height: "2.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--color-surface-2)",
              borderRadius: "var(--radius-sm)",
              background: "transparent",
              cursor: "pointer",
              color: "var(--color-ink-muted)",
              fontSize: "1.25rem",
              lineHeight: 1,
              flexShrink: 0,
              transition:
                "color var(--duration-fast), border-color var(--duration-fast), background var(--duration-fast)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-ink)";
              e.currentTarget.style.borderColor = "var(--color-ink-muted)";
              e.currentTarget.style.background = "var(--color-surface-2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-ink-muted)";
              e.currentTarget.style.borderColor = "var(--color-surface-2)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            ×
          </button>
        </header>

        {/* ── Domain list ─────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1rem 1.5rem 1.5rem",
          }}
        >
          {sortedDomains.length === 0 ? (
            <EmptyState />
          ) : (
            <ul
              role="list"
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {sortedDomains.map((domain) => (
                <li key={domain.domainId}>
                  <DomainRow domain={domain} onPractice={handlePractice} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1rem",
        gap: "0.75rem",
        textAlign: "center",
        color: "var(--color-ink-muted)",
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="20"
          cy="20"
          r="18"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.4"
        />
        <path
          d="M12 20h16M20 12v16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
        />
      </svg>
      <p
        style={{
          margin: 0,
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: "var(--color-ink-soft)",
        }}
      >
        No domain data yet
      </p>
      <p style={{ margin: 0, fontSize: "var(--text-xs)" }}>
        Complete exam questions to unlock domain insights.
      </p>
    </div>
  );
}

// ── Domain row ────────────────────────────────────────────────────────────────

interface DomainRowProps {
  domain: DomainMastery;
  onPractice: (domainId: string) => void;
}

function DomainRow({ domain, onPractice }: DomainRowProps) {
  const color = accuracyColor(domain.accuracy);
  const bg = accuracyBgColor(domain.accuracy);
  const srsPct = Math.round(domain.srsCoverage * 100);

  return (
    <div
      style={{
        padding: "1rem 1.125rem",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-surface-2)",
        background: "var(--color-surface-2)",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
      }}
    >
      {/* Domain name + accuracy badge */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            color: "var(--color-ink)",
            lineHeight: 1.35,
            flex: 1,
          }}
        >
          {domain.domainName}
        </p>
        <span
          aria-label={`Accuracy: ${domain.accuracy}%`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.2rem 0.55rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            color,
            background: bg,
            border: `1px solid ${color}`,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.01em",
            flexShrink: 0,
          }}
        >
          {domain.accuracy}%
        </span>
      </div>

      {/* SRS coverage */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <SrsIcon />
        <span
          style={{ fontSize: "var(--text-xs)", color: "var(--color-ink-soft)" }}
        >
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>
            {srsPct}%
          </strong>{" "}
          covered
          {domain.dueCount > 0 && (
            <span
              style={{ color: "var(--color-warn)", marginLeft: "0.375rem" }}
            >
              · {domain.dueCount} due
            </span>
          )}
        </span>
      </div>

      {/* Practice CTA */}
      <button
        onClick={() => onPractice(domain.domainId)}
        aria-label={`Practice ${domain.domainName}`}
        style={{
          alignSelf: "flex-start",
          padding: "0.375rem 0.875rem",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-accent)",
          background: "transparent",
          color: "var(--color-accent)",
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          cursor: "pointer",
          letterSpacing: "0.01em",
          transition:
            "background var(--duration-fast), color var(--duration-fast)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--color-accent)";
          e.currentTarget.style.color = "#fff";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--color-accent)";
        }}
      >
        Practice this domain
      </button>
    </div>
  );
}

function SrsIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, color: "var(--color-ink-muted)" }}
    >
      <path
        d="M6 1.5A4.5 4.5 0 1 1 1.5 6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M1.5 3.5V6H4"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
