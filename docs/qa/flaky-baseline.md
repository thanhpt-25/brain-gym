# E2E Flaky Test Baseline — US-101

**Date:** 2026-04-29
**Branch:** sprint1/us-101-e2e-isolation

---

## Backend E2E Test Files

| File                                      | Description                          |
| ----------------------------------------- | ------------------------------------ |
| `backend/test/app.e2e-spec.ts`            | Basic health / public endpoint smoke |
| `backend/test/assessments.e2e-spec.ts`    | Candidate assessment lifecycle       |
| `backend/test/certifications.e2e-spec.ts` | Certification CRUD + uniqueness      |
| `backend/test/exam-catalog.e2e-spec.ts`   | Org exam catalog management          |
| `backend/test/flashcards.e2e-spec.ts`     | Flashcard deck CRUD + SRS scheduling |
| `backend/test/org-analytics.e2e-spec.ts`  | Org analytics endpoints              |
| `backend/test/org-questions.e2e-spec.ts`  | Org private question bank            |
| `backend/test/organizations.e2e-spec.ts`  | Org membership, invites, join-links  |

---

## Observed Isolation Problems (Pre-US-101)

### 1. Shared DB state between spec files

- No `beforeEach` truncation. Data created in one spec leaks into subsequent specs when run in the same process (even at `maxWorkers:1`).
- `certifications.e2e-spec.ts` cleans up manually in `afterAll` — if the test fails mid-run, cleanup is skipped and the next run's `beforeAll` finds stale rows.

### 2. Provider race condition / duplicate key

- Multiple spec files call `createTestCertification` in `e2e-helpers.ts`, all trying to `findUnique` then `create` the same slug `e2e-test-provider`.
- Under sequential execution this is mostly safe, but `afterAll` cleanup of `certifications.e2e-spec.ts` deletes the provider, while `organizations.e2e-spec.ts` (if run after) re-creates it. A failed `afterAll` leaves a dangling provider row.
- Pattern was a try/catch P2002 workaround, not a real upsert.

### 3. Cleanup relies on email-prefix scanning

- `cleanupByEmail` in `e2e-helpers.ts` does a partial string match to find users, then manually chains delete calls in the right FK order.
- This is fragile: any missed FK target causes a foreign-key constraint error that masks the real test failure.

### 4. No global migrate step

- Each CI run calls `npx prisma migrate deploy` as a standalone step before `npm run test:e2e`, but there was no `globalSetup` to verify DB connectivity and apply migrations before Jest starts spinning up NestJS apps.

---

## New Pattern (Post-US-101)

### Per-file truncation via `cleanDb`

```typescript
// In every e2e spec
beforeEach(async () => {
  await cleanDb(prisma as any);
});
```

`cleanDb` (at `backend/test/helpers/db-cleanup.ts`) issues `TRUNCATE … RESTART IDENTITY CASCADE` on every table in FK-safe order (leaf tables first, root tables last). This guarantees a blank slate for every individual test without relying on afterAll cleanup.

### Idempotent fixtures

- `getOrCreateProvider` — upserts by slug; safe whether or not the table was just truncated.
- `createTestUser` / `createAdminUser` — always creates a fresh user post-truncation; no email collision possible.

### Global setup once

`backend/test/global-setup.ts` runs once before the Jest suite:

1. Verifies `DATABASE_URL` is set.
2. Confirms DB TCP connectivity.
3. Calls `prisma migrate deploy`.

This removes the fragile CI step dependency and ensures the schema is current before any app boots.

### Quarantine mechanism

`backend/test/quarantine.json` tracks known-flaky tests. The companion script `backend/test/helpers/quarantine-check.ts` enforces a maximum of 5 quarantined tests, failing CI if the list grows beyond that. Each quarantine entry requires a Linear issue ID.

---

## Quarantine Process

1. If a test is confirmed flaky (fails in ≥2 independent CI runs with no code change), add it to `quarantine.json`:

```json
{
  "test": "Organizations (e2e) > should allow owner to remove member",
  "issue": "CG-123",
  "reason": "Redis pub/sub timing on membership event",
  "quarantinedAt": "2026-04-29"
}
```

2. Wrap the test with `.skip` referencing the issue:

```typescript
it.skip('CG-123: should allow owner to remove member', async () => { ... });
```

3. The `quarantine-check` step runs in CI. It fails if `quarantined.length > 5`, preventing quarantine list rot.

4. Each quarantined test must be resolved within the sprint it was quarantined in.

---

## Files Created / Modified

| Path                                       | Action                                               |
| ------------------------------------------ | ---------------------------------------------------- |
| `backend/test/helpers/db-cleanup.ts`       | New — FK-safe truncate helper                        |
| `backend/test/helpers/auth-fixture.ts`     | New — idempotent user + JWT factory                  |
| `backend/test/helpers/provider-fixture.ts` | New — idempotent provider/cert upsert                |
| `backend/test/helpers/quarantine-check.ts` | New — CI quarantine guard script                     |
| `backend/test/helpers/index.ts`            | New — re-exports all helpers                         |
| `backend/test/global-setup.ts`             | New — pre-suite DB verify + migrate                  |
| `backend/test/quarantine.json`             | New — quarantine registry (empty)                    |
| `backend/test/jest-e2e.json`               | Updated — wires globalSetup                          |
| `backend/test/app.e2e-spec.ts`             | Updated — uses cleanDb pattern                       |
| `backend/test/certifications.e2e-spec.ts`  | Updated — uses cleanDb + new helpers                 |
| `playwright.config.ts`                     | New — Playwright root config                         |
| `e2e/smoke.spec.ts`                        | New — 3 frontend smoke specs                         |
| `package.json`                             | Updated — test:e2e scripts + @playwright/test devDep |
| `.github/workflows/ci.yml`                 | Updated — e2e-smoke CI job                           |
