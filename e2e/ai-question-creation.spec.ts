import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://localhost";
const EMAIL = "admin@braingym.com";
const PASSWORD = "password123";

test.describe("AI Question Creation flow", () => {
  test.use({ baseURL: BASE });

  test("login → /ai-generate renders generator page with tabs", async ({
    page,
  }) => {
    await page.goto("/auth");
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
      timeout: 15_000,
    });

    await page.goto("/ai-generate");

    await expect(
      page.getByRole("heading", { name: /AI Question Generator/i }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole("tab", { name: /AI Settings/i })).toBeVisible();
  });

  test("backend /llm-configs endpoint reachable when authenticated", async ({
    request,
  }) => {
    const login = await request.post(`${BASE}/api/v1/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    const body = await login.json();
    const token = body.accessToken || body.access_token || body.token;
    expect(token).toBeTruthy();

    const cfg = await request.get(`${BASE}/api/v1/ai-questions/llm-configs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(cfg.status());
  });
});
