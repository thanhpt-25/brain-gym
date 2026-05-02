# Accessibility Baseline (US-306)

This document records the accessibility baseline for CertGym after the
Sprint 03 US-306 remediation pass. It establishes the routes covered by
the automated axe-core gate, the Lighthouse Accessibility targets, and
maps each fix to its governing WCAG 2.2 success criterion.

## Routes Covered

| #   | Route          | Lighthouse a11y target | Notes                                                             |
| :-- | :------------- | :--------------------: | :---------------------------------------------------------------- |
| 1   | `/`            |          ≥ 95          | Landing — Hero, certification library, features, footer           |
| 2   | `/auth`        |          ≥ 95          | Sign-in / register — single form, no nav distractions             |
| 3   | `/dashboard`   |          ≥ 95          | Authenticated dashboard (redirects to /auth when unauth)          |
| 4   | `/exam`        |          ≥ 95          | Exam intro/library entry                                          |
| 5   | `/srs/today`   |          ≥ 95          | SRS daily review (Sprint 03 new route; placeholder until shipped) |
| 6   | `/flashcards`  |          ≥ 95          | Flashcards entry; `/decks` is the canonical alias                 |
| 7   | `/exams`       |          ≥ 95          | Exam library                                                      |
| 8   | `/leaderboard` |          ≥ 95          | Public leaderboard                                                |

The axe-core gate (`e2e/a11y.spec.ts`) blocks any merge that introduces a
`critical` or `serious` violation on these routes.

## How to Run

### Run the axe-core gate locally

```bash
# All a11y tests (8 routes)
npx playwright test e2e/a11y.spec.ts

# Single route (debugging)
npx playwright test e2e/a11y.spec.ts -g "'/auth' has no critical"

# UI mode for visual debugging
npx playwright test e2e/a11y.spec.ts --ui
```

### Run Lighthouse a11y on a single route

```bash
npx lhci collect --url=http://localhost:8080/
# Reports land in .lighthouseci/; open the HTML to see the a11y category.
```

### Manual screen reader smoke

- macOS: VoiceOver (Cmd + F5) — verify the skip-to-main link appears on
  the first Tab press; landmark navigation (VO + U → "Landmarks") lists
  `banner`, `main`, `contentinfo`.
- Windows: NVDA — same checks via `Insert + F7`.

## Top-10 Issues Fixed

Each row maps an issue from `docs/team-planning/04-ux-qa-lead.md` §A11y
to the file(s) changed and the WCAG 2.2 success criterion it satisfies.

| #   | Issue                                                          | Fix                                                                                                                | WCAG 2.2 SC                                        |
| :-- | :------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- | :------------------------------------------------- |
| 1   | ExamPage timer relies on color only                            | Timer node carries `aria-live="polite"` and an SR-only "X minutes Y seconds remaining" string in addition to color | 1.4.1 Use of Color, 4.1.3 Status Messages          |
| 2   | Mark-for-review icon button has no accessible name             | `<Button aria-label="Mark question for review" aria-pressed={...}>` on the Flag icon button                        | 4.1.2 Name, Role, Value                            |
| 3   | Exam confirm-submit modal does not trap focus                  | Submit triggers Radix `<AlertDialog>` (already focus-trapped); restored focus to trigger on close                  | 2.4.3 Focus Order, 2.1.2 No Keyboard Trap          |
| 4   | Flashcard flip uses transform only — SR cannot tell it flipped | Card root has `aria-pressed={isFlipped}` and `aria-label` reflecting the visible face                              | 4.1.2 Name, Role, Value                            |
| 5   | Dashboard charts have no text alternative                      | Each `<CardTitle>` is wired to `aria-labelledby` on the chart wrapper, plus a visually-hidden `<table>` summary    | 1.1.1 Non-text Content, 1.3.1 Info & Relationships |
| 6   | Color-only weak/strong domain indicators                       | Added icon (`AlertTriangle` / `CheckCircle`) and text label ("weak" / "strong") in addition to color               | 1.4.1 Use of Color                                 |
| 7   | Page transitions ignore `prefers-reduced-motion`               | `useReducedMotion` hook drops Y-translate from `PageTransition` and shortens fade duration                         | 2.3.3 Animation from Interactions                  |
| 8   | Touch targets below 24×24 (icon nav, rating buttons)           | Mobile tab bar buttons forced to 44×44 hit area; SRS rating buttons sized `min-h-12 min-w-12`                      | 2.5.8 Target Size (Minimum)                        |
| 9   | Form errors only colored red, no message                       | RHF + Zod render `<p role="alert" id="...-error">`; inputs reference via `aria-describedby` and `aria-invalid`     | 3.3.1 Error Identification, 3.3.3 Error Suggestion |
| 10  | Exam timer auto-submits without warning                        | "1 minute remaining" toast announcement (`role="status"`); Lenient mode offers extend                              | 2.2.1 Timing Adjustable                            |

## Structural Improvements (cross-cutting)

These are not in the top-10 but raise the Lighthouse a11y score for
every route at once:

- **Skip to main content** (`src/components/SkipToContent.tsx`) — first
  focusable element on every page; jumps to `<main id="main-content">`.
  Satisfies WCAG **2.4.1 Bypass Blocks**.
- **Landmark structure** — `Navbar` is `<nav aria-label="Main navigation">`,
  `BottomTabBar` is `<nav aria-label="Mobile navigation">`, page bodies
  wrap in `<main id="main-content" tabIndex={-1}>`, page footers use
  `<footer>`. Satisfies **1.3.1 Info & Relationships** and
  **2.4.6 Headings & Labels**.
- **Decorative icons** — every Lucide icon paired with a text label is
  now `aria-hidden="true"` so SR users do not hear "image" duplicates.
  Satisfies **1.1.1 Non-text Content**.
- **Reduced-motion hook** — `src/hooks/useReducedMotion.ts` is the
  single source of truth for `prefers-reduced-motion: reduce`. Used by
  `PageTransition` and intended for the new SRS / Readiness / Squad
  components per the Sprint 03 plan.

## CI Wiring

Add this step to the existing GitHub Actions workflow (after the build
step) to enforce the gate:

```yaml
- name: Accessibility gate (axe-core)
  run: npx playwright test e2e/a11y.spec.ts
```

The job inherits the `webServer` block from `playwright.config.ts`, so
the dev server is started automatically.

## Maintenance

- Re-run `npx playwright test e2e/a11y.spec.ts` after any UI change.
- New routes added to the app **must** be appended to the `routes`
  array in `e2e/a11y.spec.ts` and to the table above.
- When introducing visualizations (charts, gauges), add a
  visually-hidden data-table alternative under the chart and reference
  it via `aria-describedby`.
- Manual SR smoke (NVDA + VoiceOver) is required once per release per
  `docs/team-planning/04-ux-qa-lead.md` §7.

## References

- `docs/team-planning/04-ux-qa-lead.md` §7 — A11y roadmap and top-10 source list
- `docs/team-planning/sprint-03-implementation-plan.md` — US-306 scope
- WCAG 2.2 — https://www.w3.org/TR/WCAG22/
- axe-core rules — https://dequeuniversity.com/rules/axe/
