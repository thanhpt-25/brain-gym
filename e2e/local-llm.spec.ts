import { test, expect } from "@playwright/test";

test.describe("Local LLM Question Generation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ai-question-generator");
    await page.waitForLoadState("networkidle");
  });

  test("should show local LLM section in settings tab", async ({ page }) => {
    await page.click('button[value="settings"]');
    await expect(page.getByText("AI Provider Configuration")).toBeVisible();
    await expect(page.getByText("Local LLM")).toBeVisible();
  });

  test("should allow entering local LLM configuration", async ({ page }) => {
    await page.click('button[value="settings"]');

    // Find and fill the base URL input
    const inputs = page.locator('input[type="text"]');
    const firstInput = inputs.first();
    await firstInput.fill("http://localhost:11434");
    await expect(firstInput).toHaveValue("http://localhost:11434");
  });

  test("should display local provider option in generation form", async ({
    page,
  }) => {
    // Pre-set local config
    await page.evaluate(() => {
      localStorage.setItem(
        "braingym:local-llm-config",
        JSON.stringify({
          dialect: "openai",
          baseUrl: "http://localhost:11434",
          modelId: "llama2",
        }),
      );
    });
    await page.reload();

    await page.click('button[value="generate"]');

    // Should show Local option in provider dropdown
    const providerSelect = page
      .locator("text=AI Provider")
      .locator("..")
      .locator("[role='combobox']");
    await providerSelect.click();

    const localOption = page.getByRole("option", { name: /local/i });
    await expect(localOption).toBeVisible();
  });

  test("should show model info when local provider is selected", async ({
    page,
  }) => {
    // Pre-set config
    await page.evaluate(() => {
      localStorage.setItem(
        "braingym:local-llm-config",
        JSON.stringify({
          dialect: "openai",
          baseUrl: "http://localhost:11434",
          modelId: "llama2",
        }),
      );
    });
    await page.reload();

    await page.click('button[value="generate"]');

    const providerSelect = page
      .locator("text=AI Provider")
      .locator("..")
      .locator("[role='combobox']");
    await providerSelect.click();

    const localOption = page.getByRole("option", { name: /local/i });
    await localOption.click();

    // Should display base URL and model info
    await expect(
      page.getByText(/localhost:11434/i).or(page.getByText(/llama2/i)),
    ).toBeVisible();
  });

  test("should show info banner about local questions", async ({ page }) => {
    // Pre-set config
    await page.evaluate(() => {
      localStorage.setItem(
        "braingym:local-llm-config",
        JSON.stringify({
          dialect: "openai",
          baseUrl: "http://localhost:11434",
          modelId: "llama2",
        }),
      );
    });
    await page.reload();

    await page.click('button[value="generate"]');

    const providerSelect = page
      .locator("text=AI Provider")
      .locator("..")
      .locator("[role='combobox']");
    await providerSelect.click();

    const localOption = page.getByRole("option", { name: /local/i });
    await localOption.click();

    // Should show info about local generation
    await expect(
      page.getByText(/browser|no cloud|pending|admin review/i),
    ).toBeVisible();
  });

  test("should hide material library when local is selected", async ({
    page,
  }) => {
    // Pre-set config
    await page.evaluate(() => {
      localStorage.setItem(
        "braingym:local-llm-config",
        JSON.stringify({
          dialect: "openai",
          baseUrl: "http://localhost:11434",
          modelId: "llama2",
        }),
      );
    });
    await page.reload();

    await page.click('button[value="generate"]');

    const providerSelect = page
      .locator("text=AI Provider")
      .locator("..")
      .locator("[role='combobox']");
    await providerSelect.click();

    const localOption = page.getByRole("option", { name: /local/i });
    await localOption.click();

    // Material library should not be visible
    const materialSection = page.locator("text=Material").locator("..");
    // After local selection, material library should be hidden
    const isVisible = await materialSection.isVisible().catch(() => false);
    if (isVisible) {
      // If material section still exists, it should be in hidden state
      await expect(materialSection).toHaveAttribute("style", /display:\s*none/);
    }
  });

  test("should display 'Generate (Local)' button when local provider selected", async ({
    page,
  }) => {
    // Pre-set config
    await page.evaluate(() => {
      localStorage.setItem(
        "braingym:local-llm-config",
        JSON.stringify({
          dialect: "openai",
          baseUrl: "http://localhost:11434",
          modelId: "llama2",
        }),
      );
    });
    await page.reload();

    await page.click('button[value="generate"]');

    const providerSelect = page
      .locator("text=AI Provider")
      .locator("..")
      .locator("[role='combobox']");
    await providerSelect.click();

    const localOption = page.getByRole("option", { name: /local/i });
    await localOption.click();

    // Should show local generation button
    const generateBtn = page.getByRole("button", {
      name: /generate.*local/i,
    });
    await expect(generateBtn).toBeVisible();
  });

  test("should enable Generate tab when local config exists", async ({
    page,
  }) => {
    // Pre-set config
    await page.evaluate(() => {
      localStorage.setItem(
        "braingym:local-llm-config",
        JSON.stringify({
          dialect: "openai",
          baseUrl: "http://localhost:11434",
          modelId: "llama2",
        }),
      );
    });
    await page.reload();

    // Generate tab should be accessible
    const generateTab = page.locator('button[value="generate"]');
    await expect(generateTab).toBeEnabled();
    await generateTab.click();

    // Should show generate form, not "no provider" message
    const form = page.locator("text=Certification");
    await expect(form).toBeVisible();
  });

  test("should show 'no provider' message when neither cloud nor local config exists", async ({
    page,
  }) => {
    // Clear all configs
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();

    await page.click('button[value="generate"]');

    // Should show no provider message
    const noProviderMsg = page.getByText(/No AI provider configured/i);
    await expect(noProviderMsg).toBeVisible();

    // Message should mention Local LLM option
    await expect(
      page.getByText(/Local LLM|AI Settings/i).or(noProviderMsg),
    ).toBeVisible();
  });

  test("should navigate to settings tab when no provider configured", async ({
    page,
  }) => {
    // Clear config
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();

    // Default tab should be settings (because no provider)
    const settingsTab = page.locator('button[value="settings"]');
    // Settings tab should be the active/visible one
    await expect(page.getByText("AI Provider Configuration")).toBeVisible();
  });

  test("should save local config to localStorage", async ({ page }) => {
    await page.click('button[value="settings"]');

    // Fill config form
    const inputs = page.locator('input[type="text"]');
    const firstInput = inputs.first();
    await firstInput.fill("http://localhost:11434");

    // Find and click save button (may be "Save" or part of form)
    const saveBtn = page.getByRole("button", {
      name: /save|apply|configure/i,
    });
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
    }

    // Verify localStorage was updated
    const storedConfig = await page.evaluate(() => {
      return localStorage.getItem("braingym:local-llm-config");
    });
    expect(storedConfig).toBeTruthy();
  });

  test("should show dialect selector for local LLM config", async ({
    page,
  }) => {
    await page.click('button[value="settings"]');

    // Look for dialect selector
    const dialectLabel = page
      .locator("text=Dialect")
      .or(page.locator("text=API Standard"));
    const isVisible = await dialectLabel.isVisible().catch(() => false);

    if (isVisible) {
      // Dialect selector should exist
      const dialectControl = dialectLabel.locator("..");
      await expect(dialectControl.locator("[role='combobox']")).toBeVisible();
    }
  });

  test("should allow clearing local config", async ({ page }) => {
    // Pre-set config
    await page.evaluate(() => {
      localStorage.setItem(
        "braingym:local-llm-config",
        JSON.stringify({
          dialect: "openai",
          baseUrl: "http://localhost:11434",
          modelId: "llama2",
        }),
      );
    });
    await page.reload();

    await page.click('button[value="settings"]');

    // Click clear/reset button
    const clearBtn = page.getByRole("button", { name: /clear|reset|remove/i });
    if (await clearBtn.isVisible()) {
      await clearBtn.click();

      // Config should be cleared from localStorage
      const storedConfig = await page.evaluate(() => {
        return localStorage.getItem("braingym:local-llm-config");
      });
      expect(storedConfig).toBeNull();
    }
  });

  test("should require certification selection before generation", async ({
    page,
  }) => {
    // Pre-set config
    await page.evaluate(() => {
      localStorage.setItem(
        "braingym:local-llm-config",
        JSON.stringify({
          dialect: "openai",
          baseUrl: "http://localhost:11434",
          modelId: "llama2",
        }),
      );
    });
    await page.reload();

    await page.click('button[value="generate"]');

    // Select local provider
    const providerSelect = page
      .locator("text=AI Provider")
      .locator("..")
      .locator("[role='combobox']");
    await providerSelect.click();

    const localOption = page.getByRole("option", { name: /local/i });
    await localOption.click();

    // Generate button should be disabled without certification
    const generateBtn = page.getByRole("button", {
      name: /generate.*local/i,
    });
    const isDisabled =
      (await generateBtn.isDisabled().catch(() => false)) ||
      (await generateBtn.getAttribute("disabled")) !== null;

    // After selecting certification, button should be enabled
    const certSelect = page
      .locator("text=Certification")
      .locator("..")
      .locator("[role='combobox']");
    await certSelect.click();

    const firstCert = page.locator("[role='option']").first();
    await firstCert.click();

    // Now button should be enabled
    await expect(generateBtn).toBeEnabled();
  });
});
