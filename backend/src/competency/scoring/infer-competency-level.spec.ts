import {
  inferCompetencyLevel,
  DEFAULT_THRESHOLDS_1_5,
  InferCompetencyLevelOptions,
} from './infer-competency-level';

const opts: InferCompetencyLevelOptions = {
  scaleMin: 1,
  scaleMax: 5,
  thresholds: DEFAULT_THRESHOLDS_1_5,
};

describe('inferCompetencyLevel', () => {
  // TC1 — happy path: multiple domains, sufficient sample → HIGH
  it('aggregates multiple domains and returns HIGH confidence when sample >= 20', () => {
    const result = inferCompetencyLevel(
      {
        Networking: { correct: 18, total: 20 },
        Security: { correct: 9, total: 10 },
        Storage: { correct: 1, total: 5 }, // not in mappedDomains — ignored
      },
      ['Networking', 'Security'],
      opts,
    );
    expect(result.level).toBe(5);
    expect(result.percentage).toBe(90.0);
    expect(result.confidence).toBe('HIGH');
    expect(result.sampleSize).toBe(30);
    expect(result.matchedDomains).toEqual(['Networking', 'Security']);
  });

  // TC2 — no matching domain
  it('returns level=scaleMin, percentage=0, confidence=LOW when no domain matches', () => {
    const result = inferCompetencyLevel(
      { Compute: { correct: 4, total: 5 } },
      ['Networking'],
      opts,
    );
    expect(result.level).toBe(1);
    expect(result.percentage).toBe(0);
    expect(result.confidence).toBe('LOW');
    expect(result.sampleSize).toBe(0);
    expect(result.matchedDomains).toHaveLength(0);
  });

  // TC3 — case-insensitive, partial overlap, small sample → LOW
  it('matches case-insensitively and returns LOW for small sample', () => {
    const result = inferCompetencyLevel(
      { networking: { correct: 3, total: 6 } },
      ['NETWORKING', 'Databases'],
      opts,
    );
    expect(result.level).toBe(2); // 50% → bucket [40,60) → level 2
    expect(result.percentage).toBe(50.0);
    expect(result.confidence).toBe('LOW'); // sampleSize 6 < 8
    expect(result.sampleSize).toBe(6);
    expect(result.matchedDomains).toEqual(['NETWORKING']);
  });

  // TC4 — boundary: exactly 75% uses >= so hits level 4; sampleSize=8 → MEDIUM
  it('uses >= for threshold boundary and returns MEDIUM at sample=8', () => {
    const result = inferCompetencyLevel(
      { Security: { correct: 6, total: 8 } },
      ['security'],
      opts,
    );
    expect(result.level).toBe(4);
    expect(result.percentage).toBe(75.0);
    expect(result.confidence).toBe('MEDIUM');
  });

  // TC5 — empty domainScores
  it('handles empty domainScores', () => {
    const result = inferCompetencyLevel({}, ['Networking'], opts);
    expect(result.level).toBe(1);
    expect(result.percentage).toBe(0);
    expect(result.confidence).toBe('LOW');
    expect(result.sampleSize).toBe(0);
  });

  // TC6 — empty mappedDomains
  it('handles empty mappedDomains', () => {
    const result = inferCompetencyLevel(
      { Networking: { correct: 5, total: 10 } },
      [],
      opts,
    );
    expect(result.level).toBe(1);
    expect(result.percentage).toBe(0);
  });

  // TC7 — domain with total=0 does not produce NaN or division-by-zero
  it('ignores domains with total=0 without crashing', () => {
    const result = inferCompetencyLevel(
      {
        Networking: { correct: 0, total: 0 },
        Security: { correct: 8, total: 10 },
      },
      ['Networking', 'Security'],
      opts,
    );
    expect(result.percentage).toBe(80.0);
    expect(result.sampleSize).toBe(10);
  });

  // TC8 — custom scale 1–4
  it('respects custom scaleMin/scaleMax and thresholds', () => {
    const customOpts: InferCompetencyLevelOptions = {
      scaleMin: 1,
      scaleMax: 4,
      thresholds: [
        { minPercentage: 80, level: 4 },
        { minPercentage: 55, level: 3 },
        { minPercentage: 30, level: 2 },
        { minPercentage: 0, level: 1 },
      ],
    };
    const result = inferCompetencyLevel(
      { Networking: { correct: 9, total: 10 } },
      ['Networking'],
      customOpts,
    );
    expect(result.level).toBe(4); // 90% >= 80 → level 4
  });

  // TC9 — whitespace trimming
  it('trims whitespace from domain keys', () => {
    const result = inferCompetencyLevel(
      { ' networking ': { correct: 5, total: 10 } },
      ['NETWORKING'],
      opts,
    );
    expect(result.percentage).toBe(50.0);
    expect(result.matchedDomains).toEqual(['NETWORKING']);
  });

  // TC10 — HIGH confidence at exactly minSampleForHigh
  it('returns HIGH confidence when sampleSize equals minSampleForHigh (20)', () => {
    const result = inferCompetencyLevel(
      { Networking: { correct: 10, total: 20 } },
      ['Networking'],
      opts,
    );
    expect(result.confidence).toBe('HIGH');
    expect(result.level).toBe(2); // 50% → level 2
  });
});
