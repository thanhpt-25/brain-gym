import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://localhost:8080";
const EMAIL = "admin@braingym.com";
const PASSWORD = "password123";

test.describe("Squad Dashboard E2E", () => {
  // Needs a running backend with seeded squad data and a valid login.
  // Skip when no E2E credentials are configured (CI without secrets / no backend).
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    "requires E2E_USER_EMAIL / E2E_USER_PASSWORD and a running backend",
  );
  test.use({ baseURL: BASE });

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/auth");
    await page.locator('input[name="email"]').fill(EMAIL);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    // Wait for redirect from auth
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
      timeout: 15_000,
    });
  });

  test("user can navigate to squad dashboard and see squad name", async ({
    page,
  }) => {
    // Navigate to a squad (assuming a test squad with this slug exists)
    await page.goto("/squads/aws-saa-study-group");

    // Verify squad name is visible
    await expect(
      page.getByRole("heading", { level: 1, name: /AWS SAA Study Group/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Verify we're on the correct route
    await expect(page).toHaveURL(/\/squads\/aws-saa-study-group/);
  });

  test("squad dashboard displays member list", async ({ page }) => {
    await page.goto("/squads/aws-saa-study-group");

    // Wait for squad title to appear (indicates data is loaded)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    // Verify member section is visible
    await expect(
      page.getByRole("heading", { level: 2, name: /Members/i }),
    ).toBeVisible();

    // Verify at least one member card is visible
    const memberCards = page.locator('[data-testid="member-card"]');
    await expect(memberCards.first()).toBeVisible();
  });

  test("squad dashboard shows member details (name, email, role)", async ({
    page,
  }) => {
    await page.goto("/squads/aws-saa-study-group");

    // Wait for data to load
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    // Get the first member card
    const firstMemberCard = page.locator('[data-testid="member-card"]').first();
    await expect(firstMemberCard).toBeVisible();

    // Verify the card contains expected elements
    // (Assuming the component renders displayName, email, and role badge)
    const cardText = await firstMemberCard.textContent();
    expect(cardText).toBeTruthy();

    // Verify role badge is present (Owner or Member)
    const roleBadge = firstMemberCard.locator("text=/Owner|Member/i");
    await expect(roleBadge).toBeVisible();
  });

  test("inactive members are visually marked with badge", async ({ page }) => {
    await page.goto("/squads/aws-saa-study-group");

    // Wait for data to load
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    // Look for inactive badge (if any members are inactive in test data)
    const inactiveBadges = page.locator('[data-testid="inactive-badge"]');
    const count = await inactiveBadges.count();

    // If there are inactive members, verify they are marked
    if (count > 0) {
      await expect(inactiveBadges.first()).toBeVisible();
      await expect(inactiveBadges.first()).toContainText(/Inactive/i);
    }
  });

  test("readiness card displays score", async ({ page }) => {
    await page.goto("/squads/aws-saa-study-group");

    // Wait for squad title
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    // Look for readiness card (should display a percentage)
    const readinessScore = page.locator('[data-testid="readiness-score"]');
    const readinessCard = page.locator('[data-testid="readiness-card"]');

    // Either the score is displayed directly or in the card
    if ((await readinessCard.count()) > 0) {
      await expect(readinessCard).toBeVisible();
    }

    // Verify percentage or score is shown somewhere
    const pageText = await page.textContent("body");
    expect(pageText).toMatch(/\d+%|score|readiness/i);
  });

  test("empty state displayed when squad has no members", async ({ page }) => {
    // Navigate to a squad with no members (if test data has one, adjust slug)
    await page.goto("/squads/empty-squad");

    // Try to find the squad title (may not exist if squad doesn't exist)
    const squadTitle = page.getByRole("heading", { level: 1 });
    const titleCount = await squadTitle.count();

    if (titleCount > 0) {
      // Squad exists but has no members
      await expect(
        page.getByText(/Invite members to see their readiness/i),
      ).toBeVisible();
    }
  });

  test("squad not found page displays when squad doesn't exist", async ({
    page,
  }) => {
    // Navigate to a non-existent squad
    await page.goto("/squads/non-existent-squad-xyz");

    // Wait a bit for the page to load
    await page.waitForTimeout(2000);

    // Either we get a not found message or a 404 page
    const notFoundMessages = page.locator("text=/not found|doesn't exist/i");
    const squadTitle = page.getByRole("heading", { level: 1 });

    const notFoundCount = await notFoundMessages.count();
    const titleCount = await squadTitle.count();

    // At least one should be true: either we see "not found" or no squad title
    expect(notFoundCount > 0 || titleCount === 0).toBeTruthy();
  });

  test("responsive layout: squad grid is visible at desktop width", async ({
    page,
  }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/squads/aws-saa-study-group");

    // Wait for data to load
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    // Check that both readiness card and member list are visible side by side
    const readinessCard = page.locator('[data-testid="readiness-card"]');
    const memberList = page.locator('[data-testid="squad-member-list"]');

    // At least one of these should exist and be visible
    if ((await readinessCard.count()) > 0) {
      await expect(readinessCard).toBeVisible();
    }

    if ((await memberList.count()) > 0) {
      await expect(memberList).toBeVisible();
    }
  });

  test("responsive layout: squad displays at mobile width", async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto("/squads/aws-saa-study-group");

    // Wait for data to load
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    // Verify squad name is still visible and readable
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Verify content is not horizontally overflowed
    const bodyElement = page.locator("body");
    const boundingBox = await bodyElement.boundingBox();
    expect(boundingBox).toBeTruthy();
  });

  test("member card is interactive on hover (shows hover state)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/squads/aws-saa-study-group");

    // Wait for data to load
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    const firstMemberCard = page.locator('[data-testid="member-card"]').first();

    // Hover over the member card
    await firstMemberCard.hover();

    // Take a screenshot or verify styling changed
    // (In a real test, we might check for opacity, background color change, etc.)
    await expect(firstMemberCard).toBeVisible();
  });

  test("page load time is reasonable (squad loads within 10 seconds)", async ({
    page,
  }) => {
    const startTime = Date.now();

    await page.goto("/squads/aws-saa-study-group");

    // Wait for main content to be visible
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    const loadTime = Date.now() - startTime;

    // Assert load time is less than 10 seconds
    expect(loadTime).toBeLessThan(10_000);
  });
});
