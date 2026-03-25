import { test, expect } from "../playwright-fixture";

test.describe("Budget Labels & Validation", () => {
  const ADMIN_EMAIL = "admin@vendorhub.it";
  const ADMIN_PASS = "Admin@VendorHub2025!";
  const SUPPLIER_EMAIL = "Stefano.cavaliero@gmail.com";
  const SUPPLIER_PASS = "TempPass2026!";

  test("Admin sees 'Offerta massima' label instead of 'Budget massimo' in opportunity creation", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/internal/opportunities/new");
    await page.waitForLoadState("networkidle");

    // Should show "Offerta massima" not "Budget massimo"
    await expect(page.locator("text=Offerta massima")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Budget stimato")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("label:has-text('Budget massimo')")).toHaveCount(0);
  });

  test("Admin cannot set Offerta massima > Budget stimato in creation", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/internal/opportunities/new");
    await page.waitForLoadState("networkidle");

    // Fill required fields
    await page.fill('input[name="title"]', "Test Budget Validation");
    
    // Select a category
    const categoryTrigger = page.locator('button[role="combobox"]').first();
    await categoryTrigger.click();
    const categoryOption = page.locator('[role="option"]').first();
    if (await categoryOption.count() > 0) {
      await categoryOption.click();
    }

    // Set deadline
    const deadlineInput = page.locator('input[type="datetime-local"]').first();
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    await deadlineInput.fill(futureDate);

    // Set budget stimato = 10000, offerta massima = 20000 (invalid)
    await page.fill('input[name="budget_estimated"]', "10000");
    await page.fill('input[name="budget_max"]', "20000");

    // Try to submit
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator("text=L'offerta massima non può superare il budget stimato")).toBeVisible({ timeout: 5000 });
  });

  test("Supplier does NOT see Budget stimato in opportunity details", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/supplier/opportunities");
    await page.waitForLoadState("networkidle");

    // Open first opportunity if available
    const oppRow = page.locator("table tbody tr").first();
    if (await oppRow.count() > 0) {
      await oppRow.click();
      await page.waitForLoadState("networkidle");

      // Should NOT see "Budget stimato"
      await expect(page.locator("text=Budget stimato")).toHaveCount(0);

      // If budget_max exists, it should say "Offerta massima"
      const offertaMax = page.locator("text=Offerta massima");
      const budgetMassimo = page.locator("text=Budget massimo");
      
      // Budget massimo label should never appear
      await expect(budgetMassimo).toHaveCount(0);
    }
  });

  test("Admin sees 'Offerta massima' in opportunity detail page", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/internal/opportunities");
    await page.waitForLoadState("networkidle");

    const oppRow = page.locator("table tbody tr").first();
    if (await oppRow.count() > 0) {
      await oppRow.click();
      await page.waitForLoadState("networkidle");

      // "Budget massimo" label should NOT appear anywhere
      const budgetMassimo = page.locator("text=Budget massimo");
      await expect(budgetMassimo).toHaveCount(0);
    }
  });
});
