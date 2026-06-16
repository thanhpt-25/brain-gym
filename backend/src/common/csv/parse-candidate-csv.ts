export const MAX_ROWS = 1000;

export interface ParsedCandidate {
  email: string;
  name?: string;
}

export interface ParseCandidateCsvResult {
  valid: ParsedCandidate[];
  invalid: { row: number; raw: string; reason: string }[];
  duplicatesRemoved: number;
}

// RFC 5322 simplified — good enough for server-side pre-validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sanitize values that could cause formula injection if exported to spreadsheets
function sanitizeField(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function parseCandidateCsv(input: string): ParseCandidateCsvResult {
  const lines = input.split(/\r?\n/);
  const valid: ParsedCandidate[] = [];
  const invalid: { row: number; raw: string; reason: string }[] = [];
  let duplicatesRemoved = 0;

  if (lines.length === 0) {
    return { valid, invalid, duplicatesRemoved };
  }

  const headerLine = lines[0].trim();
  if (!headerLine) {
    return { valid, invalid, duplicatesRemoved };
  }

  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
  const emailIdx = headers.indexOf('email');

  if (emailIdx === -1) {
    invalid.push({
      row: 0,
      raw: headerLine,
      reason: 'Missing required "email" column',
    });
    return { valid, invalid, duplicatesRemoved };
  }

  const nameIdx =
    headers.indexOf('name') !== -1
      ? headers.indexOf('name')
      : headers.indexOf('candidatename');

  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (valid.length + invalid.length >= MAX_ROWS) {
      invalid.push({
        row: i + 1,
        raw: trimmed,
        reason: `Exceeds MAX_ROWS limit of ${MAX_ROWS}`,
      });
      continue;
    }

    const cols = trimmed.split(',').map((c) => c.trim());
    const email = (cols[emailIdx] ?? '').toLowerCase().trim();

    if (!email) {
      invalid.push({ row: i + 1, raw: trimmed, reason: 'Email is empty' });
      continue;
    }

    if (!EMAIL_RE.test(email)) {
      invalid.push({
        row: i + 1,
        raw: trimmed,
        reason: `Invalid email: "${email}"`,
      });
      continue;
    }

    if (seen.has(email)) {
      duplicatesRemoved++;
      continue;
    }

    seen.add(email);

    const candidate: ParsedCandidate = { email };
    if (nameIdx !== -1 && cols[nameIdx]) {
      candidate.name = sanitizeField(cols[nameIdx].trim());
    }

    valid.push(candidate);
  }

  return { valid, invalid, duplicatesRemoved };
}
