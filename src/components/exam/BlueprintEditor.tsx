/**
 * BlueprintEditor — P2 implementation.
 *
 * Lets users declare an exam structure along ONE axis:
 *   - "By difficulty": how many EASY / MEDIUM / HARD questions.
 *   - "By domain":     how many questions per certification domain (picked at
 *                      random across all difficulties within that domain).
 *
 * The component works in "%" mode: the user enters percentages that are
 * converted to absolute counts based on the total question count. It shows
 * real-time availability from the question bank and prevents submission when
 * any bucket is under-filled or the percentages don't add up to 100.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { getQuestionStats } from "@/services/questions";
import type { ExamBlueprint } from "@/types/api-types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Axis = "difficulty" | "domain";

/** A single allocatable bucket rendered as one slider row. */
interface BucketRow {
  /** Stable identity: difficulty enum value or domainId. */
  key: string;
  label: string;
  /** Approved questions available for this bucket, or null while loading. */
  available: number | null;
  colorClass: string;
  badgeClass: string;
}

const DIFFICULTY_ROWS: Omit<BucketRow, "available">[] = [
  {
    key: "EASY",
    label: "Easy",
    colorClass: "text-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-500",
  },
  {
    key: "MEDIUM",
    label: "Medium",
    colorClass: "text-yellow-500",
    badgeClass: "bg-yellow-500/10 text-yellow-500",
  },
  {
    key: "HARD",
    label: "Hard",
    colorClass: "text-destructive",
    badgeClass: "bg-destructive/10 text-destructive",
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface BlueprintEditorProps {
  certificationId: string;
  totalCount: number;
  /** Called with null when the blueprint is invalid */
  onChange: (blueprint: ExamBlueprint | null) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round percentages → integer counts, keeping the total sum consistent. */
function distributeByPercent(pcts: number[], total: number): number[] {
  if (pcts.length === 0) return [];
  const raw = pcts.map((p) => (p / 100) * total);
  const floored = raw.map(Math.floor);
  const remainder = total - floored.reduce((a, b) => a + b, 0);

  // Distribute remainder to the buckets with the largest fractional parts.
  const fracs = raw.map((v, i) => ({ i, f: v - floored[i] }));
  fracs.sort((a, b) => b.f - a.f);
  for (let k = 0; k < remainder; k++) {
    floored[fracs[k % fracs.length].i]++;
  }
  return floored;
}

/** Even-as-possible split of 100% across n buckets (sums to exactly 100). */
function evenSplit(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(100 / n);
  const rem = 100 - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

// ─── Component ────────────────────────────────────────────────────────────────

const BlueprintEditor = ({
  certificationId,
  totalCount,
  onChange,
}: BlueprintEditorProps) => {
  const [axis, setAxis] = useState<Axis>("difficulty");

  // Percentages are tracked per-axis so toggling preserves each axis' state.
  const [diffPcts, setDiffPcts] = useState<number[]>([30, 50, 20]);
  const [domainPcts, setDomainPcts] = useState<number[]>([]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["question-stats", certificationId],
    queryFn: () => getQuestionStats(certificationId),
    enabled: !!certificationId,
    staleTime: 30_000,
  });

  // Domain buckets, excluding uncategorized (null domainId) questions.
  const domainBuckets = useMemo(
    () =>
      (stats?.byDomain ?? [])
        .filter((d) => d.domainId)
        .map((d) => ({
          key: d.domainId as string,
          label: d.name ?? "Unknown",
          available: d.count,
        })),
    [stats],
  );

  // Initialise / resize domain percentages once the domain list is known.
  useEffect(() => {
    setDomainPcts((prev) =>
      prev.length === domainBuckets.length
        ? prev
        : evenSplit(domainBuckets.length),
    );
  }, [domainBuckets.length]);

  // Active rows + percentage state for the selected axis.
  const rows: BucketRow[] = useMemo(
    () =>
      axis === "difficulty"
        ? DIFFICULTY_ROWS.map((r) => ({
            ...r,
            available:
              stats?.byDifficulty[r.key as "EASY" | "MEDIUM" | "HARD"] ?? null,
          }))
        : domainBuckets.map((d) => ({
            key: d.key,
            label: d.label,
            available: d.available,
            colorClass: "text-primary",
            badgeClass: "bg-primary/10 text-primary",
          })),
    [axis, stats, domainBuckets],
  );

  const pcts = axis === "difficulty" ? diffPcts : domainPcts;
  const setPcts = axis === "difficulty" ? setDiffPcts : setDomainPcts;

  // Absolute counts derived from percentages.
  const counts = useMemo(
    () => distributeByPercent(pcts, totalCount),
    [pcts, totalCount],
  );

  const totalPct = pcts.reduce((a, b) => a + b, 0);
  const pctValid = totalPct === 100 && pcts.length > 0;

  // pcts and rows can be momentarily out of sync on the render right after the
  // axis or domain list changes (the resize effect runs afterwards). Treat that
  // transient state as not-yet-aligned so we never emit a half-built blueprint.
  const aligned = pcts.length === rows.length;

  // Shortage detection per row.
  const shortages = useMemo(
    () =>
      rows.map(
        (row, i) => row.available != null && counts[i] > row.available,
      ),
    [rows, counts],
  );

  const hasShortage = shortages.some(Boolean);
  const noDomains = axis === "domain" && domainBuckets.length === 0;
  const isValid =
    aligned && pctValid && !hasShortage && totalCount > 0 && !noDomains;

  // Propagate blueprint up. Depend on memoised values only (counts, axis,
  // domainBuckets) so this doesn't re-fire on every render.
  useEffect(() => {
    if (!isValid) {
      onChange(null);
      return;
    }
    if (axis === "difficulty") {
      onChange({
        byDifficulty: {
          EASY: counts[0],
          MEDIUM: counts[1],
          HARD: counts[2],
        },
      });
    } else {
      const byDomain: Record<string, number> = {};
      domainBuckets.forEach((b, i) => {
        byDomain[b.key] = counts[i];
      });
      onChange({ byDomain });
    }
  }, [isValid, counts, axis, domainBuckets, onChange]);

  const updatePct = (idx: number, value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    setPcts((prev) => {
      const next = [...prev];
      next[idx] = clamped;
      return next;
    });
  };

  const axisTabClass = (active: boolean) =>
    `flex-1 px-3 py-1.5 rounded-md text-xs font-mono transition-all ${
      active
        ? "bg-primary/15 text-primary border border-primary/40"
        : "text-muted-foreground border border-transparent hover:text-foreground"
    }`;

  return (
    <div className="glass-card p-4 space-y-4">
      {/* Axis toggle */}
      <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setAxis("difficulty")}
          className={axisTabClass(axis === "difficulty")}
        >
          By difficulty
        </button>
        <button
          type="button"
          onClick={() => setAxis("domain")}
          className={axisTabClass(axis === "domain")}
        >
          By domain
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono text-muted-foreground">
          {axis === "difficulty"
            ? "Difficulty distribution"
            : "Domain distribution"}
        </span>
        {statsLoading && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {stats && !statsLoading && (
          <span className="text-xs text-muted-foreground font-mono">
            Bank: {stats.total} approved questions
          </span>
        )}
      </div>

      {/* No-domains hint */}
      {noDomains && !statsLoading && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-white/5 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            This certification has no domains with approved questions. Use the
            "By difficulty" axis instead.
          </span>
        </div>
      )}

      {/* Rows */}
      <div className="space-y-3">
        {rows.map((row, idx) => {
          const available = row.available;
          const shortage = shortages[idx];
          const count = counts[idx];

          return (
            <div key={row.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className={`${row.colorClass} truncate pr-2`}>
                  {row.label}
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Availability badge */}
                  {available !== null && (
                    <span
                      className={`px-1.5 py-0.5 rounded ${shortage ? "bg-destructive/10 text-destructive" : "bg-white/5 text-muted-foreground"}`}
                    >
                      {count} Q
                      {shortage && (
                        <span className="ml-1">
                          (only {available})
                        </span>
                      )}
                      {!shortage && (
                        <span className="ml-1 opacity-60">/ {available} available</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Slider + number input */}
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pcts[idx] ?? 0}
                  onChange={(e) => updatePct(idx, parseInt(e.target.value))}
                  className="flex-1 accent-primary h-1.5 cursor-pointer"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={pcts[idx] ?? 0}
                    onChange={(e) =>
                      updatePct(idx, parseInt(e.target.value) || 0)
                    }
                    className="w-14 text-right bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs font-mono focus:outline-none focus:border-primary/50"
                  />
                  <span className="text-xs text-muted-foreground font-mono">%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total % indicator */}
      {rows.length > 0 && (
        <div
          className={`flex items-center justify-between text-xs font-mono pt-1 border-t ${pctValid ? "border-white/10" : "border-destructive/30"}`}
        >
          <span className="text-muted-foreground">Total</span>
          <span
            className={`font-semibold ${pctValid ? "text-primary" : "text-destructive"}`}
          >
            {totalPct}%{" "}
            {!pctValid && (
              <span className="font-normal opacity-80">
                (must equal 100%)
              </span>
            )}
          </span>
        </div>
      )}

      {/* Shortage warning */}
      {hasShortage && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {axis === "difficulty"
              ? "One or more difficulty levels require more questions than are available in the bank. Lower the percentage or choose a smaller total question count."
              : "One or more domains require more questions than are available in the bank. Lower the percentage or choose a smaller total question count."}
          </span>
        </div>
      )}

      {/* Summary counts */}
      {rows.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {rows.map((row, idx) => (
            <span
              key={row.key}
              className={`text-xs px-2 py-0.5 rounded font-mono ${row.badgeClass}`}
            >
              {row.label}: {counts[idx]} Q
            </span>
          ))}
          <span className="text-xs px-2 py-0.5 rounded font-mono bg-white/5 text-muted-foreground">
            Total: {counts.reduce((a, b) => a + b, 0)} Q
          </span>
        </div>
      )}
    </div>
  );
};

export default BlueprintEditor;
