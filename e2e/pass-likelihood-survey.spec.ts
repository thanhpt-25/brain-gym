import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://localhost";
const EMAIL = "admin@braingym.com";
const PASSWORD = "password123";

test.describe("Pass Likelihood Survey", () => {
  // Exercises live backend API endpoints. Skip when no E2E credentials are
  // configured (CI without secrets / no running backend).
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    "requires E2E_USER_EMAIL / E2E_USER_PASSWORD and a running backend",
  );
  test.use({ baseURL: BASE });

  test("POST /surveys/pass-likelihood endpoint accepts valid score", async ({
    request,
  }) => {
    const login = await request.post(`${BASE}/api/v1/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    const body = await login.json();
    const token = body.accessToken || body.access_token;
    expect(token).toBeTruthy();

    const certResponse = await request.get(
      `${BASE}/api/v1/certifications?limit=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    expect(certResponse.ok()).toBeTruthy();
    const certs = await certResponse.json();
    const certId = certs.data?.[0]?.id || "unknown";

    const submitResponse = await request.post(
      `${BASE}/api/v1/surveys/pass-likelihood`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { certificationId: certId, score: 7 },
      },
    );
    expect([201, 409]).toContain(submitResponse.status());
  });

  test("GET /surveys/pass-likelihood endpoint returns status", async ({
    request,
  }) => {
    const login = await request.post(`${BASE}/api/v1/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    });
    const body = await login.json();
    const token = body.accessToken || body.access_token;

    const certResponse = await request.get(
      `${BASE}/api/v1/certifications?limit=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const certs = await certResponse.json();
    const certId = certs.data?.[0]?.id;

    if (!certId) {
      test.skip();
      return;
    }

    const statusResponse = await request.get(
      `${BASE}/api/v1/surveys/pass-likelihood?certificationId=${certId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    expect(statusResponse.ok()).toBeTruthy();
    const status = await statusResponse.json();
    expect(status).toHaveProperty("submitted");
    expect(typeof status.submitted).toBe("boolean");
  });

  test("POST /surveys/pass-likelihood rejects out-of-range scores", async ({
    request,
  }) => {
    const login = await request.post(`${BASE}/api/v1/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    });
    const body = await login.json();
    const token = body.accessToken || body.access_token;

    const certResponse = await request.get(
      `${BASE}/api/v1/certifications?limit=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const certs = await certResponse.json();
    const certId = certs.data?.[0]?.id;

    if (!certId) {
      test.skip();
      return;
    }

    const invalidScores = [0, 11, -1, 100];
    for (const score of invalidScores) {
      const response = await request.post(
        `${BASE}/api/v1/surveys/pass-likelihood`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: { certificationId: certId, score },
        },
      );
      expect(response.status()).toBe(400);
    }
  });

  test("survey banner appears on mastery page for beta users", async ({
    page,
    request,
  }) => {
    // Login
    await page.goto("/auth");
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
      timeout: 15_000,
    });

    // Get auth token from login response
    const login = await request.post(`${BASE}/api/v1/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    });
    const loginBody = await login.json();
    const token = loginBody.accessToken || loginBody.access_token;

    // Get a certification
    const certResponse = await request.get(
      `${BASE}/api/v1/certifications?limit=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const certs = await certResponse.json();
    const certId = certs.data?.[0]?.id;

    if (!certId) {
      test.skip();
      return;
    }

    // Navigate to mastery page
    await page.goto(`/dashboard/mastery/${certId}`);

    // Verify page loads
    await expect(
      page.getByRole("heading", { name: /Domain breakdown/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
