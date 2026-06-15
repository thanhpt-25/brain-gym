export interface DomainScore {
  correct: number;
  total: number;
}

export interface Threshold {
  /** Inclusive lower bound. Thresholds must be sorted descending by minPercentage. */
  minPercentage: number;
  level: number;
}

export interface InferCompetencyLevelOptions {
  scaleMin: number;
  scaleMax: number;
  thresholds: Threshold[];
  /** sumTotal threshold for HIGH confidence (default 20) */
  minSampleForHigh?: number;
  /** sumTotal threshold for MEDIUM confidence (default 8) */
  minSampleForMedium?: number;
}

export interface CompetencyLevelResult {
  level: number;
  percentage: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  sampleSize: number;
  matchedDomains: string[];
}

/** Default thresholds for a 1–5 scale. */
export const DEFAULT_THRESHOLDS_1_5: Threshold[] = [
  { minPercentage: 90, level: 5 },
  { minPercentage: 75, level: 4 },
  { minPercentage: 60, level: 3 },
  { minPercentage: 40, level: 2 },
  { minPercentage: 0, level: 1 },
];

/**
 * Pure function — no I/O, no DB, deterministic.
 *
 * Aggregates domainScores for the mapped domains (case-insensitive) and
 * buckets the result into a level using the provided thresholds.
 */
export function inferCompetencyLevel(
  domainScores: Record<string, DomainScore>,
  mappedDomains: string[],
  options: InferCompetencyLevelOptions,
): CompetencyLevelResult {
  const { scaleMin, scaleMax, thresholds } = options;
  const minSampleForHigh = options.minSampleForHigh ?? 20;
  const minSampleForMedium = options.minSampleForMedium ?? 8;

  // Build a normalised lookup: lowercaseTrim(key) → score
  const normalised = new Map<string, DomainScore>();
  for (const [key, score] of Object.entries(domainScores)) {
    normalised.set(key.toLowerCase().trim(), score);
  }

  let sumCorrect = 0;
  let sumTotal = 0;
  const matchedDomains: string[] = [];

  for (const domain of mappedDomains) {
    const key = domain.toLowerCase().trim();
    const score = normalised.get(key);
    if (score) {
      sumCorrect += score.correct;
      sumTotal += score.total;
      matchedDomains.push(domain);
    }
  }

  if (sumTotal === 0) {
    return {
      level: scaleMin,
      percentage: 0,
      confidence: 'LOW',
      sampleSize: 0,
      matchedDomains: [],
    };
  }

  const rawPercentage = (sumCorrect / sumTotal) * 100;
  const percentage = Math.round(rawPercentage * 10) / 10;

  // Find first threshold (sorted descending) where percentage >= minPercentage
  let level = scaleMin;
  for (const t of thresholds) {
    if (percentage >= t.minPercentage) {
      level = t.level;
      break;
    }
  }
  level = Math.max(scaleMin, Math.min(scaleMax, level));

  const confidence: CompetencyLevelResult['confidence'] =
    sumTotal >= minSampleForHigh
      ? 'HIGH'
      : sumTotal >= minSampleForMedium
        ? 'MEDIUM'
        : 'LOW';

  return {
    level,
    percentage,
    confidence,
    sampleSize: sumTotal,
    matchedDomains,
  };
}
