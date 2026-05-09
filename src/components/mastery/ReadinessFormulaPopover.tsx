import React, { useEffect, useRef } from "react";
import type { ReadinessSignals } from "../../services/readiness";

export interface ReadinessFormulaPopoverProps {
  signals: ReadinessSignals;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

interface SignalRow {
  label: string;
  value: number;
  weight: string;
}

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Popover dialog explaining how the readiness score is calculated.
 * Uses a <dialog> element for proper focus management and ARIA semantics.
 * Positions itself below the anchor (info button) element.
 */
export function ReadinessFormulaPopover({
  signals,
  isOpen,
  onClose,
  anchorRef,
}: ReadinessFormulaPopoverProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = "readiness-formula-title";

  const rows: SignalRow[] = [
    { label: "SRS Coverage", value: signals.srsCoverage, weight: "25%" },
    {
      label: "14-day Accuracy",
      value: signals.recentAccuracy14d,
      weight: "40%",
    },
    { label: "Domain Spread", value: signals.domainSpread, weight: "20%" },
    { label: "Time Pressure", value: signals.timePressure, weight: "15%" },
  ];

  // Open / close the native dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) dialog.show();
      setTimeout(() => closeButtonRef.current?.focus(), 0);
    } else {
      if (dialog.open) dialog.close();
      anchorRef.current?.focus();
    }
  }, [isOpen, anchorRef]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Position below the anchor button
  const [position, setPosition] = React.useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + window.scrollY + 8,
      left: Math.max(8, rect.left + window.scrollX - 160),
    });
  }, [isOpen, anchorRef]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-modal="false"
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        width: "280px",
        padding: "1.25rem",
        border: "1px solid var(--color-surface-2)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-surface-raised)",
        color: "var(--color-ink)",
        boxShadow:
          "0 8px 32px oklch(0% 0 0 / 0.12), 0 2px 8px oklch(0% 0 0 / 0.08)",
        zIndex: 200,
        margin: 0,
        maxWidth: "calc(100vw - 1rem)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1rem",
          gap: "0.5rem",
        }}
      >
        <h3
          id={titleId}
          style={{
            margin: 0,
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--color-ink)",
            lineHeight: 1.3,
          }}
        >
          How your score is calculated
        </h3>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close formula explanation"
          style={{
            flexShrink: 0,
            width: "1.5rem",
            height: "1.5rem",
            border: "none",
            background: "none",
            cursor: "pointer",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-ink-muted)",
            fontSize: "1rem",
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition:
              "color var(--duration-fast), background var(--duration-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--color-ink)";
            e.currentTarget.style.background = "var(--color-surface-2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--color-ink-muted)";
            e.currentTarget.style.background = "none";
          }}
        >
          ×
        </button>
      </div>

      {/* Signal breakdown table */}
      <table
        style={{ width: "100%", borderCollapse: "collapse" }}
        aria-label="Score signal breakdown"
      >
        <thead>
          <tr>
            {(["Signal", "Your value", "Weight"] as const).map((heading) => (
              <th
                key={heading}
                scope="col"
                style={{
                  textAlign: heading === "Signal" ? "left" : "right",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  color: "var(--color-ink-muted)",
                  paddingBottom: "0.5rem",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              style={{ borderTop: "1px solid var(--color-surface-2)" }}
            >
              <td
                style={{
                  padding: "0.5rem 0",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-ink-soft)",
                }}
              >
                {row.label}
              </td>
              <td
                style={{
                  textAlign: "right",
                  padding: "0.5rem 0",
                  fontSize: "var(--text-sm)",
                  fontWeight: 500,
                  color: "var(--color-ink)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {toPercent(row.value)}
              </td>
              <td
                style={{
                  textAlign: "right",
                  padding: "0.5rem 0",
                  fontSize: "var(--text-sm)",
                  color: "var(--color-ink-muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {row.weight}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </dialog>
  );
}
