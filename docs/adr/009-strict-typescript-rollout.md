# RFC-009: Strict TypeScript Enforcement for Sprint 5 New Modules

**Date:** 2026-05-29  
**Status:** APPROVED (Sprint 5, US-509)  
**Owner:** Senior FE + Tech Lead  
**Related:** Decision D9 (TypeScript strictness baseline)

---

## 1. Decision

All new modules introduced in Sprint 5 (Behavioral Insights, Squads, Reviewer Queue, and related utilities) **MUST** be authored in `strict: true` TypeScript mode. Existing loose-TS modules are NOT required to migrate, but new code in existing modules must comply.

---

## 2. Scope

### Backend Modules (Strict TS enforcement from Day 1)

| Module                                    | Story  | Strict? | Coverage | Notes                                                                  |
| ----------------------------------------- | ------ | ------- | -------- | ---------------------------------------------------------------------- |
| `backend/src/insights/behavioral/`        | US-503 | 🟢 ✅   | ≥80%     | patterns.ts, behavioral.service.ts, behavioral.processor.ts all strict |
| `backend/src/squads/`                     | US-505 | 🟢 ✅   | ≥80%     | squads.service.ts, squads.controller.ts, DTOs all strict               |
| `backend/src/admin/` (Reviewer Queue)     | US-508 | 🟢 ✅   | ≥80%     | moderation list + audit trail, all strict                              |
| `backend/src/ai-question-bank/llm-usage/` | US-507 | 🟢 ✅   | ≥80%     | llm-quota.service.ts, quota enforcement all strict                     |

### Frontend Modules (Strict TS enforcement from Day 1)

| Module                         | Story  | Strict? | Coverage | Notes                                                     |
| ------------------------------ | ------ | ------- | -------- | --------------------------------------------------------- |
| `src/components/squads/`       | US-506 | 🟢 ✅   | ≥80%     | SquadDashboard, SquadMemberList, ReadinessCard all strict |
| `src/pages/SquadDashboard.tsx` | US-506 | 🟢 ✅   | ≥80%     | Page container strict                                     |
| `src/services/squads.ts`       | US-506 | 🟢 ✅   | ≥80%     | Service layer strict                                      |
| `src/components/insights/`     | US-504 | 🟢 ✅   | ≥80%     | BehavioralInsightBanner + test, all strict                |

---

## 3. Implementation Checklist

### Per-Module Compliance

Each module must verify:

- [ ] `tsconfig.json` references applied (via `"strict": true` in compiler options)
- [ ] All function parameters have explicit types (no implicit `any`)
- [ ] All object literals have type annotations (interfaces or inline)
- [ ] No `any` types unless exceptional case with inline comment `// @ts-ignore` with justification
- [ ] Return types explicit on all exported functions
- [ ] `null` and `undefined` handled explicitly (no optional chaining without null-guard)
- [ ] Type guards in place for runtime narrowing (e.g., `typeof x === 'string'`)
- [ ] All async functions have explicit return type (`Promise<T>`)
- [ ] All callbacks/handlers typed (event handlers, `useEffect`, etc.)

### Test Coverage

- [ ] Unit tests ≥80% for new modules
- [ ] Type coverage tool (`type-coverage`) passes with >95% threshold
- [ ] No `any` types in test files (use `unknown` + type guards or explicit mocks)

### Build-Time Enforcement

Pre-commit hook: `npm run typecheck` must pass before commit.

```bash
# In package.json scripts:
"typecheck": "tsc --noEmit --pretty false"
```

---

## 4. Backlog: Existing Loose Modules

Modules authored before Sprint 5 with `strict: false` remain untouched in this sprint. Candidates for future migration:

- `backend/src/auth/` (JWT, Passport)
- `backend/src/organizations/` (legacy core)
- `backend/src/assessments/` (core exam engine)
- `src/pages/` (legacy routes)
- `src/components/ui/` (shadcn/ui base layer)

These will be addressed in a separate RFC-TBD after Sprint 5.

---

## 5. Pre-Commit Hook

Each repository (root for FE, `backend/` for BE) has a **post-commit hook** enforcing strict TS on modified files in scope:

```bash
#!/bin/bash
# .git/hooks/post-commit (or via husky)

# Check if any file in scope changed
CHANGED_FILES=$(git diff --cached --name-only)

for FILE in $CHANGED_FILES; do
  # If file is in a strict-TS module...
  if [[ $FILE =~ (insights/behavioral|squads|admin|llm-usage|components/squads|pages/SquadDashboard|services/squads|components/insights) ]]; then
    # Run typecheck on that file
    npx tsc --noEmit "$FILE" || exit 1
  fi
done

exit 0
```

Failure blocks commit; developer must fix types and re-commit.

---

## 6. Migration Criteria for Existing Modules

If new code is added to an existing loose-TS module (e.g., new method in `services/auth.ts`):

- **Option A (Preferred):** Author new code in strict TS, use type guards/asserts at module boundary
- **Option B:** Migrate entire file to strict TS (requires code review + full test suite run)
- **Option C:** Isolate new code in a new `*.strict.ts` file and re-export from original

Example (Option A):

```typescript
// services/auth.ts (loose TS, existing)
export function oldLooseMethod(user: any) {
  return user.id; // implicit any, no type guard
}

// services/auth.strict.ts (new, strict TS)
import type { User } from "@/types";

export function newStrictMethod(user: User): string {
  return user.id; // explicit type, strict TS
}

// services/auth.ts re-exports for legacy consumers
export { newStrictMethod } from "./auth.strict";
```

---

## 7. Type Coverage Baseline

Run `type-coverage` on each strict module at code freeze:

```bash
npx type-coverage --at-least 95 --pretty false
```

Must show ≥95% coverage on new modules. Exceptions require explicit RFC amendment.

---

## 8. Definition of Done (US-509)

- [ ] All modules in §2 tables pass `npm run typecheck`
- [ ] Type coverage ≥95% on all strict modules
- [ ] Pre-commit hook installed and tested (local + CI)
- [ ] Zero `any` types outside of justified `// @ts-ignore` comments
- [ ] PR description includes type-coverage and typecheck output
- [ ] Code review sign-off from Tech Lead (type safety assessment)

---

## 9. Risks & Mitigations

| Risk                                                   | Mitigation                                       |
| ------------------------------------------------------ | ------------------------------------------------ |
| Developers bypass strict TS for speed                  | Pre-commit hook enforces; CI gate on type errors |
| Existing tests in loose TS can't import strict modules | Tests inherit strict TS; use type-safe mocks     |
| Refactoring overhead blocks delivery                   | 3 SP buffer + descope to US-510/511 if needed    |

---

## 10. Approval

- **Tech Lead:** ✅ APPROVED
- **Senior FE:** ✅ APPROVED (owns implementation)
- **QA:** ✅ Noted (type coverage is code quality signal)

**Date Approved:** 2026-05-29  
**Sprint:** 5  
**Status:** ACTIVE

---

## 11. Related Documents

- `../../tsconfig.json` — Root TypeScript config (strict: false globally; per-module overrides via `"references"`)
- `../../backend/tsconfig.json` — Backend TS config
- `docs/adr/003-pass-predictor-v0.md` — Earlier type safety decision (legacy context)
- `docs/team-planning/sprint-05-implementation-plan.md` — Sprint plan (§US-509 references this RFC)
