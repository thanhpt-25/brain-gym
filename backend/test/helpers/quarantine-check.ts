/**
 * CI guard: fail if quarantine.json has more than MAX_QUARANTINED entries.
 *
 * Run via: ts-node backend/test/helpers/quarantine-check.ts
 * Or add to a CI step: npx ts-node backend/test/helpers/quarantine-check.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const MAX_QUARANTINED = 5;
const QUARANTINE_FILE = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'quarantine.json',
);

interface QuarantineEntry {
  test: string;
  issue: string;
  reason: string;
  quarantinedAt: string;
}

interface QuarantineConfig {
  quarantined: QuarantineEntry[];
  lastUpdated: string;
  note: string;
}

function main(): void {
  if (!fs.existsSync(QUARANTINE_FILE)) {
    console.log(`[quarantine-check] ${QUARANTINE_FILE} not found — skipping`);
    process.exit(0);
  }

  const raw = fs.readFileSync(QUARANTINE_FILE, 'utf-8');
  const config: QuarantineConfig = JSON.parse(raw);
  const count = config.quarantined.length;

  if (count > MAX_QUARANTINED) {
    console.error(
      `[quarantine-check] FAIL: ${count} quarantined tests exceeds limit of ${MAX_QUARANTINED}.`,
    );
    console.error(
      '[quarantine-check] Fix or remove quarantined tests before merging.',
    );
    config.quarantined.forEach((entry) => {
      console.error(`  - ${entry.test} (issue: ${entry.issue})`);
    });
    process.exit(1);
  }

  console.log(
    `[quarantine-check] OK: ${count}/${MAX_QUARANTINED} quarantined tests.`,
  );
  process.exit(0);
}

main();
