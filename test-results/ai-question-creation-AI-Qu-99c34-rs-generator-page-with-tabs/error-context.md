# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ai-question-creation.spec.ts >> AI Question Creation flow >> login → /ai-generate renders generator page with tabs
- Location: e2e/ai-question-creation.spec.ts:10:3

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - link "Skip to main content" [ref=e3] [cursor=pointer]:
    - /url: "#main-content"
  - main [ref=e5]:
    - generic [ref=e6]:
      - img [ref=e9]
      - heading "Sign in to CertGym" [level=2] [ref=e19]
      - paragraph [ref=e20]: Ready to crush your next certification?
    - generic [ref=e22]:
      - generic [ref=e23]:
        - button "Sign In" [active] [ref=e24] [cursor=pointer]
        - button "Register" [ref=e25] [cursor=pointer]
      - generic [ref=e26]:
        - generic [ref=e27]:
          - generic [ref=e28]: Email address
          - textbox "you@example.com" [ref=e30]: admin@braingym.com
        - generic [ref=e31]:
          - generic [ref=e32]: Password
          - textbox "••••••••" [ref=e34]: password123
        - button "Sign In" [ref=e36] [cursor=pointer]:
          - text: Sign In
          - img [ref=e37]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | const BASE = process.env.E2E_BASE_URL || "http://localhost";
  4  | const EMAIL = "admin@braingym.com";
  5  | const PASSWORD = "password123";
  6  | 
  7  | test.describe("AI Question Creation flow", () => {
  8  |   test.use({ baseURL: BASE });
  9  | 
  10 |   test("login → /ai-generate renders generator page with tabs", async ({
  11 |     page,
  12 |   }) => {
  13 |     await page.goto("/auth");
  14 |     await page.locator('input[name="email"]').fill(EMAIL);
  15 |     await page.locator('input[name="password"]').fill(PASSWORD);
  16 |     await page
  17 |       .getByRole("button", { name: /sign in|log ?in|continue/i })
  18 |       .first()
  19 |       .click();
  20 | 
> 21 |     await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
     |                ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  22 |       timeout: 15_000,
  23 |     });
  24 | 
  25 |     await page.goto("/ai-generate");
  26 | 
  27 |     await expect(
  28 |       page.getByRole("heading", { name: /AI Question Generator/i }),
  29 |     ).toBeVisible({ timeout: 10_000 });
  30 | 
  31 |     await expect(page.getByRole("tab", { name: /AI Settings/i })).toBeVisible();
  32 |   });
  33 | 
  34 |   test("backend /llm-configs endpoint reachable when authenticated", async ({
  35 |     request,
  36 |   }) => {
  37 |     const login = await request.post(`${BASE}/api/v1/auth/login`, {
  38 |       data: { email: EMAIL, password: PASSWORD },
  39 |     });
  40 |     expect(login.ok()).toBeTruthy();
  41 |     const body = await login.json();
  42 |     const token = body.accessToken || body.access_token || body.token;
  43 |     expect(token).toBeTruthy();
  44 | 
  45 |     const cfg = await request.get(`${BASE}/api/v1/ai-questions/llm-configs`, {
  46 |       headers: { Authorization: `Bearer ${token}` },
  47 |     });
  48 |     expect([200, 404]).toContain(cfg.status());
  49 |   });
  50 | });
  51 | 
```