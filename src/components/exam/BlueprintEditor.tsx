/**
 * BlueprintEditor — P1 implementation.
 *
 * Lets users declare how many EASY / MEDIUM / HARD questions they want.
 * The component works in "%" mode: user enters percentages that are
 * converted to absolute counts based on the total question count.
 * It shows real-time availability from the question bank and prevents
 * submission when any bucket is under-filled.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { getQuestionStats } from "@/services/questions";
import type { ExamBlueprint } from "@/types/api-types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DifficultyRow {
  key: "EASY" | "MEDIUM" | "HARD";
  label: string;
  colorClass: string;
  badgeClass: string;
}

const ROWS: DifficultyRow[] = [
  {
    key: "EASY",
    label: "Dễ",
    colorClass: "text-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-500",
  },
  {
    key: "MEDIUM",
    label: "Trung bình",
    colorClass: "text-yellow-500",
    badgeClass: "bg-yellow-500/10 text-yellow-500",
  },
  {
    key: "HARD",
    label: "Khó",
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

/** Round percentage → integer count, keeping total sum consistent. */
function distributeByPercent(
  pcts: [number, number, number],
  total: number,
): [number, number, number] {
  const raw = pcts.map((p) => (p / 100) * total);
  const floored = raw.map(Math.floor) as [number, number, number];
  const remainder = total - floored.reduce((a, b) => a + b, 0);

  // Distribute remainder to the bucket with the largest fractional part.
  const fracs = raw.map((v, i) => ({ i, f: v - floored[i] }));
  fracs.sort((a, b) => b.f - a.f);
  for (let k = 0; k < remainder; k++) {
    floored[fracs[k % 3].i]++;
  }
  return floored;
}

// ─── Component ────────────────────────────────────────────────────────────────

const BlueprintEditor = ({
  certificationId,
  totalCount,
  onChange,
}: BlueprintEditorProps) => {
  // Percentages for each difficulty (default: 30 / 50 / 20).
  const [pcts, setPcts] = useState<[number, number, number]>([30, 50, 20]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["question-stats", certificationId],
    queryFn: () => getQuestionStats(certificationId),
    enabled: !!certificationId,
    staleTime: 30_000,
  });

  // Absolute counts derived from percentages.
  const counts = useMemo(
    () => distributeByPercent(pcts, totalCount),
    [pcts, totalCount],
  );

  const totalPct = pcts.reduce((a, b) => a + b, 0);
  const pctValid = totalPct === 100;

  // Shortage detection per row.
  const shortages = useMemo(() => {
    if (!stats) return [false, false, false];
    return ROWS.map((row, i) => {
      const available = stats.byDifficulty[row.key] ?? 0;
      return counts[i] > available;
    }) as [boolean, boolean, boolean];
  }, [stats, counts]);

  const hasShortage = shortages.some(Boolean);
  const isValid = pctValid && !hasShortage && totalCount > 0;

  // Propagate blueprint up.
  useEffect(() => {
    if (!isValid) {
      onChange(null);
      return;
    }
    onChange({
      byDifficulty: {
        EASY: counts[0],
        MEDIUM: counts[1],
        HARD: counts[2],
      },
    });
  }, [isValid, counts, onChange]);

  const updatePct = (idx: number, value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    setPcts((prev) => {
      const next = [...prev] as [number, number, number];
      next[idx] = clamped;
      return next;
    });
  };

  return (
    <div className="glass-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono text-muted-foreground">
          Phân bổ cấu trúc đề
        </span>
        {statsLoading && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {stats && !statsLoading && (
          <span className="text-xs text-muted-foreground font-mono">
            Ngân hàng: {stats.total} câu đã duyệt
          </span>
        )}
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {ROWS.map((row, idx) => {
          const available = stats?.byDifficulty[row.key] ?? null;
          const shortage = shortages[idx];
          const count = counts[idx];

          return (
            <div key={row.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className={row.colorClass}>{row.label}</span>

                <div className="flex items-center gap-2">
                  {/* Availability badge */}
                  {available !== null && (
                    <span
                      className={`px-1.5 py-0.5 rounded ${shortage ? "bg-destructive/10 text-destructive" : "bg-white/5 text-muted-foreground"}`}
                    >
                      {count} câu
                      {shortage && (
                        <span className="ml-1">
                          (chỉ có {available})
                        </span>
                      )}
                      {!shortage && available !== null && (
                        <span className="ml-1 opacity-60">/ {available} có sẵn</span>
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
                  value={pcts[idx]}
                  onChange={(e) => updatePct(idx, parseInt(e.target.value))}
                  className="flex-1 accent-primary h-1.5 cursor-pointer"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={pcts[idx]}
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
      <div
        className={`flex items-center justify-between text-xs font-mono pt-1 border-t ${pctValid ? "border-white/10" : "border-destructive/30"}`}
      >
        <span className="text-muted-foreground">Tổng</span>
        <span
          className={`font-semibold ${pctValid ? "text-primary" : "text-destructive"}`}
        >
          {totalPct}%{" "}
          {!pctValid && (
            <span className="font-normal opacity-80">
              (cần đúng 100%)
            </span>
          )}
        </span>
      </div>

      {/* Shortage warning */}
      {hasShortage && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Một hoặc nhiều độ khó yêu cầu nhiều câu hơn số câu hiện có
            trong ngân hàng. Giảm tỉ lệ hoặc chọn tổng số câu ít hơn.
          </span>
        </div>
      )}

      {/* Summary counts */}
      <div className="flex gap-2 flex-wrap">
        {ROWS.map((row, idx) => (
          <span
            key={row.key}
            className={`text-xs px-2 py-0.5 rounded font-mono ${row.badgeClass}`}
          >
            {row.key}: {counts[idx]} câu
          </span>
        ))}
        <span className="text-xs px-2 py-0.5 rounded font-mono bg-white/5 text-muted-foreground">
          Tổng: {counts.reduce((a, b) => a + b, 0)} câu
        </span>
      </div>
    </div>
  );
};

export default BlueprintEditor;
