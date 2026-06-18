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

// Linear-time structural email check — avoids ReDoS from backtracking regex
function isValidEmail(email: string): boolean {
  if (email.length > 254) return false;
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) return false;
  const domain = email.slice(at + 1);
  if (!domain) return false;
  const dot = domain.lastIndexOf('.');
  if (dot <= 0 || dot === domain.length - 1) return false;
  // Whitespace check only — single-pass, no backtracking
  for (let i = 0; i < email.length; i++) {
    const c = email[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') return false;
  }
  return true;
}

// Sanitize values that could cause formula injection if exported to spreadsheets
function sanitizeField(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

// RFC-4180 compliant field parser — handles quoted fields containing commas and escaped quotes
function parseRFC4180Fields(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) break;
    if (line[i] === '"') {
      let val = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            val += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          val += line[i++];
        }
      }
      fields.push(val);
      if (i < line.length && line[i] === ',') i++; // skip delimiter
    } else {
      const comma = line.indexOf(',', i);
      if (comma === -1) {
        fields.push(line.slice(i));
        break;
      } else {
        fields.push(line.slice(i, comma));
        i = comma + 1;
        if (i === line.length) fields.push(''); // trailing comma
      }
    }
  }
  return fields;
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

  const headers = parseRFC4180Fields(headerLine).map((h) =>
    h.trim().toLowerCase(),
  );
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

    const cols = parseRFC4180Fields(trimmed).map((c) => c.trim());
    const email = (cols[emailIdx] ?? '').toLowerCase().trim();

    if (!email) {
      invalid.push({ row: i + 1, raw: trimmed, reason: 'Email is empty' });
      continue;
    }

    if (!isValidEmail(email)) {
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
