import { test, expect, Page } from "@playwright/test";

/**
 * US-205 — Visual Regression Suite
 * 5 critical pages × 3 breakpoints (320 / 768 / 1440)
 * Threshold: maxDiffPixels 100 (tolerates sub-pixel antialiasing)
 *
 * Run once to generate baselines:  npx playwright test visual-regression --update-snapshots
 * CI check:                        npx playwright test visual-regression
 */

const BREAKPOINTS = [
  { name: "mobile", width: 320, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const SNAPSHOT_OPTS = { maxDiffPixels: 100 };

// Pages that require no authentication
const PUBLIC_PAGES = [{ name: "landing", path: "/" }];

// Pages that need a logged-in user — skip in CI if no auth state available
const AUTH_PAGES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "flashcard-study", path: "/decks" },
  { name: "exam-library", path: "/exams" },
  { name: "leaderboard", path: "/leaderboard" },
];

async function setViewport(
  page: Page,
  bp: (typeof BREAKPOINTS)[number],
): Promise<void> {
  await page.setViewportSize({ width: bp.width, height: bp.height });
}

async function waitForPageStable(page: Page): Promise<void> {
  // Wait for network idle and any CSS animations to settle
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}

// ─── Public pages ─────────────────────────────────────────────────────────────

for (const pg of PUBLIC_PAGES) {
  for (const bp of BREAKPOINTS) {
    test(`${pg.name} @ ${bp.name} (${bp.width}px)`, async ({ page }) => {
      await setViewport(page, bp);
      await page.goto(pg.path);
      await waitForPageStable(page);

      // Mask dynamic content (timestamps, live counters)
      await expect(page).toHaveScreenshot(
        `${pg.name}-${bp.name}.png`,
        SNAPSHOT_OPTS,
      );
    });
  }
}

// ─── Auth-required pages ──────────────────────────────────────────────────────

test.describe("authenticated pages", () => {
  test.use({ storageState: "e2e/.auth/user.json" });

  for (const pg of AUTH_PAGES) {
    for (const bp of BREAKPOINTS) {
      test(`${pg.name} @ ${bp.name} (${bp.width}px)`, async ({ page }) => {
        await setViewport(page, bp);
        await page.goto(pg.path);
        await waitForPageStable(page);

        await expect(page).toHaveScreenshot(
          `${pg.name}-${bp.name}.png`,
          SNAPSHOT_OPTS,
        );
      });
    }
  }
});

// ─── Auth setup (runs once before auth-required tests) ───────────────────────

test.describe("auth setup", () => {
  test("save auth state", async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;

    // Skip if credentials not provided (CI without secrets)
    if (!email || !password) {
      test.skip();
      return;
    }

    await page.goto("/auth");
    await page.getByPlaceholder(/email/i).fill(email);
    await page.getByPlaceholder(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/dashboard");

    await page.context().storageState({ path: "e2e/.auth/user.json" });
  });
});
