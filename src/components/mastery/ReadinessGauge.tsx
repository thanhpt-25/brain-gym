import React, { useRef, useState, useEffect } from "react";
import type { ReadinessSignals } from "../../services/readiness";
import { ReadinessFormulaPopover } from "./ReadinessFormulaPopover";

export interface ReadinessGaugeProps {
  score: number | null;
  confidence: number;
  attempts: number;
  label: string;
  isPremium: boolean;
  signals?: ReadinessSignals;
  onInfoClick?: () => void;
}

// SVG geometry — 270° sweep from 225° to 495° (≡ 135°), clockwise
const SVG_W = 240;
const SVG_H = 200;
const CX = 120;
const CY = 120;
const RADIUS = 88;
const START_DEG = 225;
const SWEEP_DEG = 270;
const END_DEG = START_DEG + SWEEP_DEG; // 495

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** SVG arc path between two angles (degrees, SVG coordinate system). */
function arcPath(startDeg: number, endDeg: number): string {
  const s = degToRad(startDeg);
  const e = degToRad(endDeg);
  const x1 = CX + RADIUS * Math.cos(s);
  const y1 = CY + RADIUS * Math.sin(s);
  const x2 = CX + RADIUS * Math.cos(e);
  const y2 = CY + RADIUS * Math.sin(e);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`;
}

/** Map 0-100 score to an angle along the sweep. */
function scoreToAngle(score: number): number {
  return START_DEG + (Math.max(0, Math.min(100, score)) / 100) * SWEEP_DEG;
}

/** Stroke color for a given score value. */
function gaugeColor(score: number | null): string {
  if (score === null) return "var(--color-ink-muted)";
  if (score >= 85) return "oklch(68% 0.21 160)";
  if (score >= 70) return "var(--color-signal)";
  if (score >= 50) return "var(--color-warn)";
  return "var(--color-danger)";
}

function InfoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 7v4.5M8 5.25v.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Radial SVG gauge showing the ML-computed readiness score.
 *
 * Design: 270° arc sweep, editorial tokens, intentional light/dark modes.
 * Empty state: shown when score is null or attempts < 50.
 * Premium gate: blurs gauge and overlays upgrade CTA when isPremium is false.
 * Reduced motion: CSS arc animation is suppressed when user prefers it.
 */
export function ReadinessGauge({
  score,
  confidence,
  attempts,
  label,
  isPremium,
  signals,
  onInfoClick,
}: ReadinessGaugeProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isEmpty = score === null || attempts < 50;
  const progressPct = Math.min(100, Math.round((attempts / 50) * 100));
  const color = gaugeColor(score);
  const trackPath = arcPath(START_DEG, END_DEG);
  const filledPath =
    !isEmpty && score !== null ? arcPath(START_DEG, scoreToAngle(score)) : null;

  function handleInfoClick() {
    setPopoverOpen((v) => !v);
    onInfoClick?.();
  }

  const gaugeInner = (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Radial arc */}
      <svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        role="img"
        aria-label={
          isEmpty
            ? `Readiness score unavailable — ${attempts} of 50 required attempts completed`
            : `Readiness score: ${score} out of 100`
        }
        style={{ overflow: "visible" }}
      >
        {/* Gray track */}
        <path
          d={trackPath}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Colored filled arc */}
        {filledPath && (
          <path
            d={filledPath}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            style={
              reducedMotion
                ? {}
                : {
                    strokeDasharray: `${2 * Math.PI * RADIUS}`,
                    animation:
                      "readiness-gauge-fill 0.9s var(--ease-out-expo) forwards",
                  }
            }
          />
        )}

        {/* Partial progress arc in empty state */}
        {isEmpty && attempts > 0 && (
          <path
            d={arcPath(START_DEG, scoreToAngle(progressPct))}
            fill="none"
            stroke="var(--color-ink-muted)"
            strokeWidth="10"
            strokeLinecap="round"
            opacity="0.35"
          />
        )}

        {/* Center label — score or dash */}
        {!isEmpty && score !== null ? (
          <>
            <text
              x={CX}
              y={CY - 6}
              textAnchor="middle"
              dominantBaseline="auto"
              style={{
                fontSize: "3.25rem",
                fontWeight: 700,
                fill: color,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.03em",
              }}
            >
              {score}
            </text>
            <text
              x={CX}
              y={CY + 22}
              textAnchor="middle"
              dominantBaseline="auto"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                fill: color,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {label}
            </text>
            <text
              x={CX}
              y={CY + 41}
              textAnchor="middle"
              dominantBaseline="auto"
              style={{
                fontSize: "0.6875rem",
                fill: "var(--color-ink-muted)",
                letterSpacing: "0.02em",
              }}
            >
              {Math.round(confidence * 100)}% confidence
            </text>
          </>
        ) : (
          <text
            x={CX}
            y={CY + 8}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize: "2.25rem",
              fontWeight: 700,
              fill: "var(--color-ink-muted)",
            }}
          >
            —
          </text>
        )}
      </svg>

      {/* Empty state messaging + progress bar */}
      {isEmpty && (
        <div
          style={{
            marginTop: "0.75rem",
            textAlign: "center",
            width: "200px",
          }}
        >
          <p
            style={{
              margin: "0 0 0.5rem",
              fontSize: "var(--text-sm)",
              color: "var(--color-ink-soft)",
              lineHeight: 1.45,
            }}
          >
            Need {Math.max(0, 50 - attempts)} more questions to unlock
          </p>
          <div
            role="progressbar"
            aria-valuenow={attempts}
            aria-valuemin={0}
            aria-valuemax={50}
            aria-label={`${attempts} of 50 attempts completed`}
            style={{
              width: "100%",
              height: "4px",
              borderRadius: "2px",
              background: "var(--color-surface-2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: "100%",
                borderRadius: "2px",
                background: "var(--color-accent)",
                transition: reducedMotion
                  ? "none"
                  : "width 0.6s var(--ease-out-expo)",
              }}
            />
          </div>
          <p
            style={{
              marginTop: "0.375rem",
              fontSize: "var(--text-xs)",
              color: "var(--color-ink-muted)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {attempts} / 50
          </p>
        </div>
      )}

      {/* Info button (visible when data is available and signals are provided) */}
      {!isEmpty && signals && (
        <button
          ref={infoButtonRef}
          onClick={handleInfoClick}
          aria-label="How is this score calculated?"
          aria-expanded={popoverOpen}
          style={{
            position: "absolute",
            top: "0.375rem",
            right: "0.375rem",
            width: "1.75rem",
            height: "1.75rem",
            border: "1px solid var(--color-surface-2)",
            borderRadius: "50%",
            background: "var(--color-surface)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-ink-muted)",
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
            e.currentTarget.style.background = "var(--color-surface)";
          }}
        >
          <InfoIcon />
        </button>
      )}

      {/* Formula popover */}
      {signals && (
        <ReadinessFormulaPopover
          signals={signals}
          isOpen={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          anchorRef={infoButtonRef as React.RefObject<HTMLElement>}
        />
      )}

      {/* Keyframe for arc fill animation — injected once into document */}
      <style>{`
        @keyframes readiness-gauge-fill {
          from { stroke-dashoffset: ${2 * Math.PI * RADIUS}; }
          to   { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );

  // Premium gate
  if (!isPremium) {
    return (
      <div style={{ position: "relative", display: "inline-block" }}>
        <div
          style={{
            filter: "blur(6px)",
            pointerEvents: "none",
            userSelect: "none",
          }}
          aria-hidden="true"
        >
          {gaugeInner}
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: "var(--color-ink)",
            }}
          >
            Unlock with Premium
          </p>
          <a
            href="/upgrade"
            style={{
              display: "inline-block",
              padding: "0.5rem 1.25rem",
              borderRadius: "var(--radius-md)",
              background: "var(--color-accent)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "var(--text-sm)",
              textDecoration: "none",
              transition: "background var(--duration-fast)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--color-accent-strong)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--color-accent)";
            }}
          >
            Upgrade
          </a>
        </div>
      </div>
    );
  }

  return gaugeInner;
}
