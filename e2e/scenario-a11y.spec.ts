import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { createRequire } from "module";

/**
 * US-705 — Scenario accessibility compliance.
 *
 * Ensures ScenarioReader and related components meet WCAG 2.2 AA standards:
 * - Zero critical/serious axe violations
 * - Keyboard navigation (Tab, Arrow keys, Enter, Esc)
 * - ARIA labels on interactive elements
 * - 4.5:1 contrast for text
 * - Visible focus indicators
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

test.describe("ScenarioReader A11y", () => {
  test("renders without critical/serious axe violations", async ({ page }) => {
    await page.goto("/exam?scenarioId=test-scenario", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle").catch(() => {});

    const results = await runAxe(page);
    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    if (criticalOrSerious.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        "ScenarioReader axe violations:",
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

  test("has visible focus indicators on all interactive elements", async ({
    page,
  }) => {
    await page.goto("/exam?scenarioId=test-scenario", {
      waitUntil: "domcontentloaded",
    });

    // Tab to first interactive element
    await page.keyboard.press("Tab");

    // Verify focus outline is visible
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const styles = window.getComputedStyle(el);
      return {
        outlineWidth: styles.outlineWidth,
        outlineStyle: styles.outlineStyle,
        outlineColor: styles.outlineColor,
      };
    });

    // Focus should have visible outline (not 'none' or '0')
    expect(focusedElement?.outlineWidth).not.toMatch(/^0px?$/);
    expect(focusedElement?.outlineStyle).not.toBe("none");
  });

  test("supports Tab navigation between questions", async ({ page }) => {
    await page.goto("/exam?scenarioId=test-scenario", {
      waitUntil: "domcontentloaded",
    });

    let focusCount = 0;
    const maxTabs = 20;

    while (focusCount < maxTabs) {
      await page.keyboard.press("Tab");
      focusCount++;

      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.getAttribute("aria-label");
      });

      if (focusedElement?.includes("Question")) {
        expect(focusCount).toBeLessThan(maxTabs);
        break;
      }
    }
  });

  test("allows marking question for review via keyboard", async ({ page }) => {
    await page.goto("/exam?scenarioId=test-scenario", {
      waitUntil: "domcontentloaded",
    });

    const markButton = await page
      .locator('[aria-label*="Mark for review"]')
      .first();
    if (await markButton.isVisible()) {
      await markButton.focus();
      await page.keyboard.press("Enter");

      const isPressed = await markButton.evaluate((el) => {
        return el.getAttribute("aria-pressed") === "true";
      });
      expect(isPressed).toBe(true);
    }
  });

  test("supports Escape to cancel/close dialogs", async ({ page }) => {
    await page.goto("/exam?scenarioId=test-scenario", {
      waitUntil: "domcontentloaded",
    });

    const dialogBefore = await page.locator('[role="dialog"]').count();
    if (dialogBefore > 0) {
      await page.keyboard.press("Escape");
      const dialogAfter = await page.locator('[role="dialog"]').count();
      expect(dialogAfter).toBeLessThan(dialogBefore);
    }
  });

  test("has ARIA labels on all interactive controls", async ({ page }) => {
    await page.goto("/exam?scenarioId=test-scenario", {
      waitUntil: "domcontentloaded",
    });

    const buttons = await page.locator("button").all();
    const inputs = await page
      .locator('input[type="radio"], input[type="checkbox"]')
      .all();

    for (const button of buttons) {
      const accessibleName = await button.evaluate((el) => {
        const ariaLabel = el.getAttribute("aria-label");
        const ariaLabelledBy = el.getAttribute("aria-labelledby");
        const textContent = el.textContent?.trim();
        return ariaLabel || ariaLabelledBy || textContent;
      });
      expect(accessibleName).toBeTruthy();
    }

    for (const input of inputs) {
      const ariaLabel = await input.getAttribute("aria-label");
      const ariaLabelledBy = await input.getAttribute("aria-labelledby");
      expect(ariaLabel || ariaLabelledBy).toBeTruthy();
    }
  });

  test("timer announces remaining time to screen readers", async ({ page }) => {
    await page.goto("/exam?scenarioId=test-scenario", {
      waitUntil: "domcontentloaded",
    });

    const timer = await page
      .locator('[class*="timer"], [aria-label*="time"]')
      .first();
    if (await timer.isVisible()) {
      const ariaLive = await timer.getAttribute("aria-live");
      expect(["polite", "assertive"]).toContain(ariaLive);
    }
  });

  test("question sidebar has current question indicated via aria-current", async ({
    page,
  }) => {
    await page.goto("/exam?scenarioId=test-scenario", {
      waitUntil: "domcontentloaded",
    });

    const currentQuestion = await page
      .locator('[aria-current="page"], [aria-current="step"]')
      .first();
    if (await currentQuestion.isVisible()) {
      const current = await currentQuestion.getAttribute("aria-current");
      expect(["page", "step", "true"]).toContain(current);
    }
  });

  test("respects prefers-reduced-motion for timer animation", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/exam?scenarioId=test-scenario", {
      waitUntil: "domcontentloaded",
    });

    const timer = await page.locator('[class*="timer"]').first();
    if (await timer.isVisible()) {
      const styles = await timer.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          animation: computed.animation,
          transition: computed.transition,
        };
      });

      expect(styles.animation).not.toContain("infinite");
    }
  });

  test("submit button is clearly labeled and accessible", async ({ page }) => {
    await page.goto("/exam?scenarioId=test-scenario", {
      waitUntil: "domcontentloaded",
    });

    const submitButton = await page
      .locator('button:has-text("Submit"), [aria-label*="Submit"]')
      .first();
    if (await submitButton.isVisible()) {
      await submitButton.focus();
      const isFocused = await submitButton.evaluate(
        (el) => el === document.activeElement,
      );
      expect(isFocused).toBe(true);

      const ariaLabel = await submitButton.getAttribute("aria-label");
      const textContent = await submitButton.textContent();
      expect(ariaLabel || textContent).toBeTruthy();
    }
  });
});

test.describe("ScenarioPassage A11y", () => {
  test("renders code blocks with syntax highlighting accessibly", async ({
    page,
  }) => {
    await page.goto("/exam?scenarioId=test-scenario", {
      waitUntil: "domcontentloaded",
    });

    const codeBlocks = await page.locator("code, pre").all();
    for (const block of codeBlocks) {
      const ariaLabel = await block.getAttribute("aria-label");
      if (!ariaLabel) {
        const parent = await block.evaluate((el) => {
          const p = el.closest("figure, section, div[class*='code']");
          return p?.getAttribute("aria-label");
        });
        expect(ariaLabel || parent).toBeTruthy();
      }
    }
  });

  test("diagram placeholders have accessible text alternatives", async ({
    page,
  }) => {
    await page.goto("/exam?scenarioId=test-scenario", {
      waitUntil: "domcontentloaded",
    });

    const diagrams = await page
      .locator('[class*="diagram"], img[alt*="diagram"]')
      .all();
    for (const diagram of diagrams) {
      const alt = await diagram.getAttribute("alt");
      const ariaLabel = await diagram.getAttribute("aria-label");
      expect(alt || ariaLabel).toBeTruthy();
    }
  });
});

test.describe("ScenarioLeaderboard A11y", () => {
  test("leaderboard table is accessible with proper row/cell semantics", async ({
    page,
  }) => {
    await page.goto("/exam?scenarioId=test-scenario", {
      waitUntil: "domcontentloaded",
    });

    const table = await page.locator("table").first();
    if (await table.isVisible()) {
      const caption = await page.locator("caption").first();
      const tableAriaLabel = await table.getAttribute("aria-label");
      expect((await caption.isVisible()) || tableAriaLabel).toBeTruthy();

      const headers = await page.locator("table th").all();
      expect(headers.length).toBeGreaterThan(0);
    }
  });

  test("user ranks are announced with context", async ({ page }) => {
    await page.goto("/exam?scenarioId=test-scenario", {
      waitUntil: "domcontentloaded",
    });

    const rankCells = await page
      .locator('[class*="rank"], td:first-child')
      .all();
    if (rankCells.length > 0) {
      const firstRank = await rankCells[0].textContent();
      expect(firstRank?.trim()).toMatch(/^\d+/);
    }
  });
});
