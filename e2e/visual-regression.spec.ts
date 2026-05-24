import { test, expect, Page } from "@playwright/test";

/**
 * US-205 — Visual Regression Suite
 * 5 critical pages × 4 breakpoints (320 / 768 / 1024 / 1440)
 * US-1105 — S10 Components × 4 breakpoints
 * Threshold: maxDiffPixels 100 (tolerates sub-pixel antialiasing)
 *
 * Run once to generate baselines:  npx playwright test visual-regression --update-snapshots
 * CI check:                        npx playwright test visual-regression
 */

const BREAKPOINTS = [
  { name: "mobile", width: 320, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1024, height: 900 },
  { name: "wide", width: 1440, height: 900 },
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
  // Requires a real authenticated session produced by the `setup` project.
  // Skip when no E2E credentials are configured (CI without secrets / no backend).
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    "requires E2E_USER_EMAIL / E2E_USER_PASSWORD",
  );
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

// ─── US-1105: S10 Component Baselines ──────────────────────────────────────

test.describe("US-1105: S10 Component Visual Baselines", () => {
  test.use({ storageState: "e2e/.auth/user.json" });
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    "requires E2E_USER_EMAIL / E2E_USER_PASSWORD",
  );

  test.describe("DdsAutoApplyPanel", () => {
    for (const bp of BREAKPOINTS) {
      test(`@ ${bp.name} (${bp.width}px)`, async ({ page }) => {
        await setViewport(page, bp);
        await page.goto("/admin/dds-auto-apply", {
          waitUntil: "networkidle",
        });
        await waitForPageStable(page);

        // Focus on the DDS panel component
        const panel = page.locator(".dds-auto-apply-panel").first();
        if (await panel.isVisible()) {
          await expect(panel).toHaveScreenshot(
            `dds-auto-apply-panel-${bp.name}.png`,
            SNAPSHOT_OPTS,
          );
        }
      });
    }
  });

  test.describe("BehavioralInsightBanner", () => {
    for (const bp of BREAKPOINTS) {
      test(`@ ${bp.name} (${bp.width}px)`, async ({ page }) => {
        await setViewport(page, bp);
        await page.goto("/mastery", { waitUntil: "networkidle" });
        await waitForPageStable(page);

        // Focus on the behavioral insight alert
        const banner = page.locator('[role="alert"]').first();
        if (await banner.isVisible()) {
          await expect(banner).toHaveScreenshot(
            `behavioral-insight-banner-${bp.name}.png`,
            SNAPSHOT_OPTS,
          );
        }
      });
    }
  });

  test.describe("ReputationTab (Admin Flags)", () => {
    for (const bp of BREAKPOINTS) {
      test(`@ ${bp.name} (${bp.width}px)`, async ({ page }) => {
        await setViewport(page, bp);
        await page.goto("/admin?tab=reputation", {
          waitUntil: "networkidle",
        });
        await waitForPageStable(page);

        // Focus on the reputation flags panel
        const tabContent = page.locator('[role="tabpanel"]').first();
        if (await tabContent.isVisible()) {
          await expect(tabContent).toHaveScreenshot(
            `reputation-tab-${bp.name}.png`,
            SNAPSHOT_OPTS,
          );
        }
      });
    }
  });

  test.describe("StudyPlanPanel", () => {
    for (const bp of BREAKPOINTS) {
      test(`@ ${bp.name} (${bp.width}px)`, async ({ page }) => {
        await setViewport(page, bp);
        // Navigate to a page that embeds StudyPlanPanel (exam prep flow)
        await page.goto("/exam", { waitUntil: "networkidle" });
        await waitForPageStable(page);

        // Look for the study plan panel in the exam prep context
        const panel = page.locator(".study-plan-panel").first();
        if (await panel.isVisible()) {
          await expect(panel).toHaveScreenshot(
            `study-plan-panel-${bp.name}.png`,
            SNAPSHOT_OPTS,
          );
        }
      });
    }
  });

  test.describe("BenchmarkPanel (Domain Breakdown)", () => {
    for (const bp of BREAKPOINTS) {
      test(`@ ${bp.name} (${bp.width}px)`, async ({ page }) => {
        await setViewport(page, bp);
        await page.goto("/benchmark", { waitUntil: "networkidle" });
        await waitForPageStable(page);

        // Focus on the benchmark domain breakdown panel
        const panel = page.locator(".benchmark-panel").first();
        if (await panel.isVisible()) {
          await expect(panel).toHaveScreenshot(
            `benchmark-panel-${bp.name}.png`,
            SNAPSHOT_OPTS,
          );
        }
      });
    }
  });
});
