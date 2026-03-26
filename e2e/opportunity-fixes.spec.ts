import { test, expect } from "../playwright-fixture";

test.describe("Opportunity & bid fixes", () => {
  test("budget fields are required > 0 in opportunity creation", async ({ page }) => {
    // Login as admin
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@vendorhub.it");
    await page.fill('input[type="password"]', "Admin@VendorHub2025!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/internal/);

    await page.goto("/internal/opportunities/new");
    await page.waitForSelector("text=Dati Generali");

    // Fill required fields but leave budget at 0
    await page.fill('input[name="title"]', "Test budget validation");
    // Select category
    const catTrigger = page.locator('button:has-text("Seleziona")').first();
    await catTrigger.click();
    await page.locator('[role="option"]').first().click();
    // Set deadline
    await page.fill('input[type="datetime-local"]', "2027-12-31T23:59");
    // Leave budget fields empty or 0
    await page.fill('input[name="budget_estimated"]', "0");
    await page.fill('input[name="budget_max"]', "0");

    await page.click('button:has-text("Avanti")');
    // Should show validation errors
    await expect(page.locator("text=maggiore di 0").first()).toBeVisible();
  });

  test("require_technical_offer and require_economic_offer checkboxes exist", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@vendorhub.it");
    await page.fill('input[type="password"]', "Admin@VendorHub2025!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/internal/);

    await page.goto("/internal/opportunities/new");
    await page.waitForSelector("text=Dati Generali");

    await expect(page.locator("text=Offerta Tecnica obbligatoria")).toBeVisible();
    await expect(page.locator("text=Offerta Economica obbligatoria")).toBeVisible();

    // Checkboxes should be checked by default
    const techCheck = page.locator('input[name="require_technical_offer"]');
    const econCheck = page.locator('input[name="require_economic_offer"]');
    await expect(techCheck).toBeChecked();
    await expect(econCheck).toBeChecked();
  });

  test("no collecting_bids button in opportunity detail transitions", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@vendorhub.it");
    await page.fill('input[type="password"]', "Admin@VendorHub2025!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/internal/);

    await page.goto("/internal/opportunities");
    await page.waitForSelector("h1");

    // Check that no button says "Avvia raccolta offerte"
    const collectingBtn = page.locator('button:has-text("Avvia raccolta offerte")');
    await expect(collectingBtn).toHaveCount(0);
  });

  test("supplier orders filter does not have 'Accettato' option", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "Stefano.cavaliero@gmail.com");
    await page.fill('input[type="password"]', "TempPass2026!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/supplier/);

    await page.goto("/supplier/orders");
    await page.waitForSelector("h1");

    // Open the status filter dropdown
    const filterTrigger = page.locator('[data-testid="sup-orders-status-filter"]');
    if (await filterTrigger.isVisible()) {
      await filterTrigger.click();
      await page.waitForTimeout(300);
      // "Accettato" should NOT be in the dropdown
      const acceptedOption = page.locator('[role="option"]:has-text("Accettato")');
      await expect(acceptedOption).toHaveCount(0);
    }
  });

  test("supplier orders KPI cards do not include 'Accettati'", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "Stefano.cavaliero@gmail.com");
    await page.fill('input[type="password"]', "TempPass2026!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/supplier/);

    await page.goto("/supplier/orders");
    await page.waitForSelector("h1");

    // The "Accettati" KPI card should not exist
    const acceptedCard = page.locator('[data-testid="sup-orders-kpi-accepted"]');
    await expect(acceptedCard).toHaveCount(0);
  });
});
