import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { createRequire } from "module";

/**
 * US-306 — Accessibility CI gate.
 *
 * Runs axe-core against the public-facing routes of CertGym and fails the
 * build on any `critical` or `serious` WCAG 2.0/2.1/2.2 AA violation.
 * Routes that require authentication will redirect to `/auth`; axe still
 * runs against the redirected document, which is the user-facing reality
 * for an unauthenticated visitor.
 *
 * Uses axe-core directly (transitive dep via @lhci/cli) injected via
 * page.addScriptTag to avoid a separate @axe-core/playwright devDependency.
 */

const _require = createRequire(import.meta.url);
const axeSource = readFileSync(_require.resolve("axe-core"), "utf-8");

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: unknown[];
}

interface AxeResults {
  violations: AxeViolation[];
}

async function runAxe(
  page: import("@playwright/test").Page,
): Promise<AxeResults> {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    return (
      window as unknown as { axe: { run: () => Promise<AxeResults> } }
    ).axe.run();
  });
}

const routes = [
  "/",
  "/auth",
  "/dashboard",
  "/exam",
  "/srs/today",
  "/flashcards",
  "/exams",
  "/leaderboard",
];

for (const route of routes) {
  test(`${route} has no critical/serious axe violations`, async ({ page }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    // Allow lazy-loaded route + Suspense fallback to settle.
    await page.waitForLoadState("networkidle").catch(() => {});

    const results = await runAxe(page);

    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    if (criticalOrSerious.length > 0) {
      // Surface concise diagnostics in the test report.
      // eslint-disable-next-line no-console
      console.log(
        `axe violations on ${route}:`,
        JSON.stringify(
          criticalOrSerious.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.length,
          })),
          null,
          2,
        ),
      );
    }

    expect(criticalOrSerious).toHaveLength(0);
  });
}

// ─── US-1105: S10 Component Accessibility (authenticated) ──────────────────

test.describe("US-1105: S10 Component Accessibility", () => {
  test.use({ storageState: "e2e/.auth/user.json" });
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    "requires E2E_USER_EMAIL / E2E_USER_PASSWORD",
  );

  const BREAKPOINTS = [
    { name: "mobile", width: 320, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1024, height: 900 },
    { name: "wide", width: 1440, height: 900 },
  ] as const;

  async function setViewport(page, bp): Promise<void> {
    await page.setViewportSize({ width: bp.width, height: bp.height });
  }

  async function waitForPageStable(page): Promise<void> {
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
  }

  // ─── DdsAutoApplyPanel ────────────────────────────────────────────────

  test.describe("DdsAutoApplyPanel (Gate 2 readiness)", () => {
    for (const bp of BREAKPOINTS) {
      test(`@ ${bp.name} (${bp.width}px) — axe ≥95`, async ({ page }) => {
        await setViewport(page, bp);
        await page.goto("/admin/dds-auto-apply", { waitUntil: "networkidle" });
        await waitForPageStable(page);

        const results = await runAxe(page);
        const criticalOrSerious = results.violations.filter(
          (v) => v.impact === "critical" || v.impact === "serious",
        );

        if (criticalOrSerious.length > 0) {
          // eslint-disable-next-line no-console
          console.log(
            `axe violations on /admin/dds-auto-apply @ ${bp.name}:`,
            JSON.stringify(
              criticalOrSerious.map((v) => ({
                id: v.id,
                impact: v.impact,
                help: v.help,
                nodes: v.nodes.length,
              })),
              null,
              2,
            ),
          );
        }

        expect(criticalOrSerious).toHaveLength(0);
      });
    }
  });

  // ─── ReputationTab ────────────────────────────────────────────────────

  test.describe("ReputationTab (flag review & resolution)", () => {
    for (const bp of BREAKPOINTS) {
      test(`@ ${bp.name} (${bp.width}px) — axe ≥95`, async ({ page }) => {
        await setViewport(page, bp);
        await page.goto("/admin?tab=reputation", { waitUntil: "networkidle" });
        await waitForPageStable(page);

        const results = await runAxe(page);
        const criticalOrSerious = results.violations.filter(
          (v) => v.impact === "critical" || v.impact === "serious",
        );

        if (criticalOrSerious.length > 0) {
          // eslint-disable-next-line no-console
          console.log(
            `axe violations on /admin?tab=reputation @ ${bp.name}:`,
            JSON.stringify(
              criticalOrSerious.map((v) => ({
                id: v.id,
                impact: v.impact,
                help: v.help,
                nodes: v.nodes.length,
              })),
              null,
              2,
            ),
          );
        }

        expect(criticalOrSerious).toHaveLength(0);
      });
    }
  });

  // ─── StudyPlanPanel ───────────────────────────────────────────────────

  test.describe("StudyPlanPanel (plan display & schedule)", () => {
    for (const bp of BREAKPOINTS) {
      test(`@ ${bp.name} (${bp.width}px) — axe ≥95`, async ({ page }) => {
        await setViewport(page, bp);
        await page.goto("/exam", { waitUntil: "networkidle" });
        await waitForPageStable(page);

        const results = await runAxe(page);
        const criticalOrSerious = results.violations.filter(
          (v) => v.impact === "critical" || v.impact === "serious",
        );

        if (criticalOrSerious.length > 0) {
          // eslint-disable-next-line no-console
          console.log(
            `axe violations on /exam (StudyPlanPanel) @ ${bp.name}:`,
            JSON.stringify(
              criticalOrSerious.map((v) => ({
                id: v.id,
                impact: v.impact,
                help: v.help,
                nodes: v.nodes.length,
              })),
              null,
              2,
            ),
          );
        }

        expect(criticalOrSerious).toHaveLength(0);
      });
    }
  });

  // ─── BenchmarkPanel ───────────────────────────────────────────────────

  test.describe("BenchmarkPanel (domain breakdown)", () => {
    for (const bp of BREAKPOINTS) {
      test(`@ ${bp.name} (${bp.width}px) — axe ≥95`, async ({ page }) => {
        await setViewport(page, bp);
        await page.goto("/benchmark", { waitUntil: "networkidle" });
        await waitForPageStable(page);

        const results = await runAxe(page);
        const criticalOrSerious = results.violations.filter(
          (v) => v.impact === "critical" || v.impact === "serious",
        );

        if (criticalOrSerious.length > 0) {
          // eslint-disable-next-line no-console
          console.log(
            `axe violations on /benchmark (BenchmarkPanel) @ ${bp.name}:`,
            JSON.stringify(
              criticalOrSerious.map((v) => ({
                id: v.id,
                impact: v.impact,
                help: v.help,
                nodes: v.nodes.length,
              })),
              null,
              2,
            ),
          );
        }

        expect(criticalOrSerious).toHaveLength(0);
      });
    }
  });
});
