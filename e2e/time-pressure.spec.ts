import { test, expect } from '@playwright/test';

test.describe('Time Pressure Exam Mode', () => {
  test('should display timer warnings and support Accelerated mode', async ({ page }) => {
    // Navigate directly to the mastery page for a certification (mock cert)
    // Here we'll start an exam in TIME_PRESSURE mode
    await page.goto('/dashboard/mastery/aws-saa-c03');

    // Wait for page to load and find the practice CTA
    // This assumes the user is logged in via state or bypass
    // For this e2e spec we will intercept requests to simulate the flow
    await page.route('**/api/v1/certifications/aws-saa-c03', async (route) => {
      await route.fulfill({
        status: 200,
        json: { id: 'aws-saa-c03', code: 'AWS-SAA-C03', name: 'AWS Solutions Architect' },
      });
    });

    await page.route('**/api/v1/questions?certId=aws-saa-c03*', async (route) => {
      await route.fulfill({ status: 200, json: { meta: { total: 50 }, data: [] } });
    });

    await page.route('**/api/v1/exams', async (route) => {
      await route.fulfill({
        status: 200,
        json: { id: 'exam-123', timerMode: 'TIME_PRESSURE' },
      });
    });

    await page.route('**/api/v1/attempts/start', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          attemptId: 'attempt-123',
          timeLimit: 0.1, // 6 seconds for testing
          timerMode: 'TIME_PRESSURE',
          questions: [
            { id: 'q1', title: 'Q1', choices: [{ id: 'c1', label: 'a', content: 'c1' }] },
          ],
        },
      });
    });

    // Go to Exam Page directly
    await page.goto('/exam/aws-saa-c03');

    // Start exam in Time Pressure mode
    // The ExamIntro should let us select the mode
    await page.click('text=Time Pressure');
    await page.click('button:has-text("Start Exam")');

    // The timer should start, and we should see "Accelerated Mode" banner or Time Pressure UI
    // Wait for the aria-live announcement
    const liveRegion = page.locator('div[aria-live="polite"]');
    await expect(liveRegion).toBeAttached();

    // Verify warnings based on remaining time
    // At 6 seconds, 25% is 1.5s, 10% is 0.6s, 5% is 0.3s
    // Playwright will wait for these texts to appear
    await expect(liveRegion).toHaveText(/25% time remaining/, { timeout: 10000 });
    
    // Verify the timer class changes (e.g. animate-pulse)
    const timerText = page.locator('.animate-pulse');
    await expect(timerText).toBeVisible();

    // Answer the question and submit
    await page.click('text=c1');
    await page.route('**/api/v1/attempts/attempt-123/submit', async (route) => {
      await route.fulfill({ status: 200, json: { score: 100, percentage: 100 } });
    });
    
    await page.click('button:has-text("Submit")');

    // Should see results page
    await expect(page.locator('text=Results')).toBeVisible();
  });
});
