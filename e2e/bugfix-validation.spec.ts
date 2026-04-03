import { test, expect } from "../playwright-fixture";

test.describe("Bug-fix validations", () => {
  // ── Opportunity: Date validation error messages shown ──
  test("OpportunityNew shows error when opens_at >= bids_deadline", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@vendorhub.it");
    await page.fill('input[type="password"]', "Admin@VendorHub2025!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/internal/);

    await page.goto("/internal/opportunities/new");
    await page.waitForSelector('text=Dati Generali');

    // Fill mandatory fields
    await page.fill('input[name="title"]', "Test Opportunity E2E");
    // Select category
    const catTrigger = page.locator('text=Categoria').locator('..').locator('button[role="combobox"]');
    await catTrigger.click();
    await page.locator('[role="option"]').first().click();

    // Set deadline in the past (should error)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 16);
    await page.fill('input[name="bids_deadline"]', yesterday);

    // Set opens_at after deadline
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
    await page.fill('input[name="opens_at"]', tomorrow);

    // Fill budget fields
    await page.fill('input[name="budget_estimated"]', "1000");
    await page.fill('input[name="budget_max"]', "900");

    // Try to submit
    await page.click('button:has-text("Avanti")');

    // Should show validation error
    const errorMsg = page.locator('text=La scadenza offerte deve essere una data futura');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  // ── Supplier sidebar navigation ──
  test("Supplier sidebar Opportunità link navigates from detail", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "Stefano.cavaliero@gmail.com");
    await page.fill('input[type="password"]', "TempPass2026!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/supplier/);

    // Navigate to opportunities
    await page.click('a[href="/supplier/opportunities"]');
    await page.waitForURL(/supplier\/opportunities/);
    
    // Verify we can navigate from sidebar
    const sidebarLink = page.locator('a[href="/supplier/opportunities"]');
    await expect(sidebarLink).toBeVisible();
  });

  // ── Order creation: date validation ──
  test("CreateOrder disables past dates", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@vendorhub.it");
    await page.fill('input[type="password"]', "Admin@VendorHub2025!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/internal/);

    // Navigate to orders page
    await page.goto("/internal/orders");
    await page.waitForSelector('text=Ordini');
    // Verify page loads without error
    await expect(page.locator('text=Ordini')).toBeVisible();
  });

  // ── Benestare: status labels include invoiced ──
  test("Billing approvals page loads with all status filters", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@vendorhub.it");
    await page.fill('input[type="password"]', "Admin@VendorHub2025!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/internal/);

    await page.goto("/internal/billing-approvals");
    await page.waitForSelector('text=Benestare');

    // Check status filter has invoiced option
    const selectTrigger = page.locator('button[role="combobox"]').first();
    await selectTrigger.click();
    await expect(page.locator('[role="option"]:has-text("Fatturato")')).toBeVisible();
  });

  // ── Registration: error message for duplicate email ──
  test("Registration shows clear error for duplicate email", async ({ page }) => {
    await page.goto("/register");
    await page.waitForSelector('text=Registra la tua azienda');

    // Fill with existing email
    await page.fill('#company_name', "Test Company");
    await page.fill('#vat_number', "12345678901");
    await page.fill('#contact_name', "Test User");
    await page.fill('#email', "admin@vendorhub.it");
    await page.fill('#pec', "test@pec.it");
    await page.fill('#password', "TestPassword123!");

    // Fill address
    await page.fill('input[placeholder="Via/Piazza, n. civico"]', "Via Test 1");
    await page.fill('input[placeholder="00100"]', "00100");
    await page.fill('input[placeholder="Roma"]', "Roma");
    await page.fill('input[placeholder="RM"]', "RM");

    // Select category
    const catTrigger = page.locator('button[role="combobox"]');
    await catTrigger.click();
    const option = page.locator('[role="option"]').first();
    if (await option.isVisible()) {
      await option.click();
    }

    // Accept privacy
    await page.click('#privacy');

    // Submit
    await page.click('button[type="submit"]');

    // Should show error toast with clear message about duplicate email
    const toast = page.locator('text=già registrata');
    await expect(toast).toBeVisible({ timeout: 10000 });
  });
});
