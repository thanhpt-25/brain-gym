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
