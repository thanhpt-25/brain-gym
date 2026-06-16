import { parseCandidateCsv, MAX_ROWS } from './parse-candidate-csv';

describe('parseCandidateCsv', () => {
  describe('valid rows', () => {
    it('parses email-only CSV', () => {
      const input = 'email\nalice@example.com\nbob@example.com';
      const result = parseCandidateCsv(input);
      expect(result.valid).toEqual([
        { email: 'alice@example.com' },
        { email: 'bob@example.com' },
      ]);
      expect(result.invalid).toHaveLength(0);
      expect(result.duplicatesRemoved).toBe(0);
    });

    it('parses name column', () => {
      const input = 'email,name\nalice@example.com,Alice\nbob@example.com,Bob';
      const result = parseCandidateCsv(input);
      expect(result.valid[0]).toEqual({
        email: 'alice@example.com',
        name: 'Alice',
      });
    });

    it('parses candidateName column variant', () => {
      const input = 'email,candidateName\nalice@example.com,Alice';
      const result = parseCandidateCsv(input);
      expect(result.valid[0]).toEqual({
        email: 'alice@example.com',
        name: 'Alice',
      });
    });

    it('ignores extra columns', () => {
      const input =
        'email,department,name\nalice@example.com,Engineering,Alice';
      const result = parseCandidateCsv(input);
      expect(result.valid[0]).toEqual({
        email: 'alice@example.com',
        name: 'Alice',
      });
    });

    it('normalises email to lowercase', () => {
      const input = 'email\nALICE@Example.COM';
      const result = parseCandidateCsv(input);
      expect(result.valid[0].email).toBe('alice@example.com');
    });

    it('trims whitespace around fields', () => {
      const input = 'email , name\n  alice@example.com , Alice  ';
      const result = parseCandidateCsv(input);
      expect(result.valid[0]).toEqual({
        email: 'alice@example.com',
        name: 'Alice',
      });
    });

    it('skips blank lines', () => {
      const input = 'email\nalice@example.com\n\nbob@example.com\n';
      const result = parseCandidateCsv(input);
      expect(result.valid).toHaveLength(2);
    });

    it('handles CRLF line endings', () => {
      const input = 'email\r\nalice@example.com\r\nbob@example.com';
      const result = parseCandidateCsv(input);
      expect(result.valid).toHaveLength(2);
    });
  });

  describe('invalid rows', () => {
    it('reports missing email column in header', () => {
      const input = 'name\nAlice';
      const result = parseCandidateCsv(input);
      expect(result.invalid[0].reason).toMatch(/Missing required "email"/);
      expect(result.valid).toHaveLength(0);
    });

    it('reports invalid email format', () => {
      const input = 'email\nnot-an-email';
      const result = parseCandidateCsv(input);
      expect(result.invalid[0]).toMatchObject({
        row: 2,
        reason: expect.stringContaining('Invalid email'),
      });
    });

    it('reports empty email', () => {
      const input = 'email,name\n,Alice';
      const result = parseCandidateCsv(input);
      expect(result.invalid[0].reason).toBe('Email is empty');
    });

    it('continues processing after invalid row', () => {
      const input = 'email\nnot-valid\nbob@example.com';
      const result = parseCandidateCsv(input);
      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(1);
    });
  });

  describe('deduplication', () => {
    it('removes duplicate emails (case-insensitive)', () => {
      const input =
        'email\nalice@example.com\nALICE@Example.COM\nbob@example.com';
      const result = parseCandidateCsv(input);
      expect(result.valid).toHaveLength(2);
      expect(result.duplicatesRemoved).toBe(1);
    });

    it('keeps first occurrence when deduping', () => {
      const input =
        'email,name\nalice@example.com,Alice1\nalice@example.com,Alice2';
      const result = parseCandidateCsv(input);
      expect(result.valid[0].name).toBe('Alice1');
    });
  });

  describe('formula injection sanitization', () => {
    it('prefixes name starting with = to prevent formula injection', () => {
      const input = 'email,name\nalice@example.com,=SUM(1+1)';
      const result = parseCandidateCsv(input);
      expect(result.valid[0].name).toBe("'=SUM(1+1)");
    });

    it('prefixes names starting with + - @', () => {
      const cases = ['+cmd', '-cmd', '@cmd'];
      for (const val of cases) {
        const input = `email,name\nalice@example.com,${val}`;
        const r = parseCandidateCsv(input);
        expect(r.valid[0].name).toBe(`'${val}`);
      }
    });
  });

  describe('MAX_ROWS limit', () => {
    it('flags rows beyond MAX_ROWS as invalid', () => {
      const rows = Array.from(
        { length: MAX_ROWS + 5 },
        (_, i) => `user${i}@example.com`,
      );
      const input = ['email', ...rows].join('\n');
      const result = parseCandidateCsv(input);
      const limitErrors = result.invalid.filter((e) =>
        e.reason.includes('MAX_ROWS'),
      );
      expect(limitErrors.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('returns empty result for empty string', () => {
      const result = parseCandidateCsv('');
      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(0);
    });

    it('returns empty result for header-only CSV', () => {
      const result = parseCandidateCsv('email');
      expect(result.valid).toHaveLength(0);
    });

    it('handles single candidate', () => {
      const result = parseCandidateCsv('email\nalice@example.com');
      expect(result.valid).toHaveLength(1);
    });
  });
});
