export interface ReadinessSignals {
  srsCoverage: number; // 0-1
  recentAccuracy14d: number; // 0-1
  domainSpread: number; // 0-1
  timePressure: number; // 0-1
}

export interface ReadinessResult {
  score: number; // 0-100 integer
  confidence: number; // 0-0.95
  signals: ReadinessSignals;
}

const WEIGHTS = {
  srsCoverage: 0.25,
  recentAccuracy14d: 0.4,
  domainSpread: 0.2,
  timePressure: 0.15,
} as const;

export function computeReadinessScore(
  signals: ReadinessSignals,
  attempts: number,
): ReadinessResult {
  const srsCoverage = clamp01(signals.srsCoverage);
  const recentAccuracy14d = clamp01(signals.recentAccuracy14d);
  const domainSpread = clamp01(signals.domainSpread);
  const timePressure = clamp01(signals.timePressure);

  const raw =
    srsCoverage * WEIGHTS.srsCoverage +
    recentAccuracy14d * WEIGHTS.recentAccuracy14d +
    domainSpread * WEIGHTS.domainSpread +
    timePressure * WEIGHTS.timePressure;

  const score = Math.min(100, Math.max(0, Math.round(raw * 100)));
  const confidence = Math.min(0.95, attempts / 100);

  return {
    score,
    confidence,
    signals: { srsCoverage, recentAccuracy14d, domainSpread, timePressure },
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
