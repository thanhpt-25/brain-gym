import { test, expect } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.locator('h1, [data-testid="hero-heading"]').first(),
  ).toBeVisible();
});

test("auth page renders", async ({ page }) => {
  await page.goto("/auth");
  await expect(
    page.locator('form, [data-testid="auth-form"]').first(),
  ).toBeVisible();
});

test("protected route redirects to auth", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth/);
});
