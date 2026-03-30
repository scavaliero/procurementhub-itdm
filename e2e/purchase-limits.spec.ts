import { test, expect } from "../playwright-fixture";

test.describe("Purchase Limits E2E", () => {
  const ADMIN_EMAIL = "admin@vendorhub.it";
  const ADMIN_PASS = "Admin@VendorHub2025!";

  async function loginAsAdmin(page: import("@playwright/test").Page) {
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/internal/, { timeout: 15000 });
  }

  test("Purchase limits page shows existing limits", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/purchasing/limits");
    await page.waitForLoadState("networkidle");

    // Page heading visible
    await expect(page.locator("text=Limiti di Acquisto per Ruolo").first()).toBeVisible({ timeout: 10000 });

    // Should show at least one limit card (not the empty state)
    await expect(page.locator("text=Nessun limite configurato")).not.toBeVisible({ timeout: 5000 });

    // Verify known roles appear
    await expect(page.locator("text=purchase_manager").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=finance_approver").first()).toBeVisible();

    // Verify currency amounts are shown
    await expect(page.locator("text=5.000")).toBeVisible();
    await expect(page.locator("text=100.000")).toBeVisible();
  });

  test("Can open edit dialog for an existing limit", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/purchasing/limits");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Limiti di Acquisto per Ruolo").first()).toBeVisible({ timeout: 10000 });

    // Click first "Modifica" button
    const editBtn = page.locator("text=Modifica").first();
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();

    // Dialog should open
    await expect(page.locator("text=Modifica limite")).toBeVisible({ timeout: 5000 });

    // Form fields should be pre-filled
    const amountInput = page.locator('input[type="number"]').first();
    await expect(amountInput).not.toHaveValue("");

    // Close dialog
    await page.click("text=Annulla");
  });

  test("Can open create dialog", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/purchasing/limits");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Limiti di Acquisto per Ruolo").first()).toBeVisible({ timeout: 10000 });

    await page.click("text=Nuovo limite");

    // Dialog should open with create title
    await expect(page.locator("text=Nuovo limite di acquisto")).toBeVisible({ timeout: 5000 });

    // Role select should be available
    await expect(page.locator("text=Seleziona un ruolo")).toBeVisible();

    await page.click("text=Annulla");
  });
});
