import { test as setup } from "@playwright/test";
import { mkdirSync } from "fs";
import { dirname } from "path";

/**
 * Auth setup project — runs once before authenticated specs.
 *
 * Produces `e2e/.auth/user.json` so dependent specs can load a storage state
 * without crashing. When E2E credentials are absent (e.g. CI without secrets
 * or no running backend) an empty storage state is written instead, and the
 * authenticated specs skip themselves via the same env check.
 */

const AUTH_FILE = "e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  mkdirSync(dirname(AUTH_FILE), { recursive: true });

  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    // No credentials: write an empty state so storageState reads don't ENOENT.
    await page.context().storageState({ path: AUTH_FILE });
    return;
  }

  await page.goto("/auth");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
    timeout: 15_000,
  });

  await page.context().storageState({ path: AUTH_FILE });
});
