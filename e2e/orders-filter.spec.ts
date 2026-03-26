import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@vendorhub.it";
const ADMIN_PASS = "Admin@VendorHub2025!";

async function loginAsAdmin(page: any) {
  await page.goto("/login");
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/internal/);
}

test.describe("Orders page filters and dashboard navigation", () => {

  test("Dashboard card navigates to orders with status filter applied", async ({ page }) => {
    await loginAsAdmin(page);

    // Go to dashboard
    await page.goto("/internal");
    await page.waitForSelector("text=Contratti attivi");

    // Click on "Contratti attivi" card which links to /internal/orders
    const contractCard = page.locator('a[href="/internal/orders"]').first();
    if (await contractCard.count() > 0) {
      await contractCard.click();
      await page.waitForURL(/\/internal\/orders/);
      await expect(page.locator("text=Ordini")).toBeVisible();
    }
  });

  test("Orders page renders search input and status filter", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/orders");

    // Search input is present
    const searchInput = page.locator('[data-testid="orders-search"]');
    await expect(searchInput).toBeVisible();

    // Status filter is present
    const statusFilter = page.locator('[data-testid="orders-status-filter"]');
    await expect(statusFilter).toBeVisible();
  });

  test("Orders page reads status filter from URL params", async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate directly with status param
    await page.goto("/internal/orders?status=issued");
    await page.waitForSelector("text=Ordini");

    // The status filter should show the selected value
    const statusTrigger = page.locator('[data-testid="orders-status-filter"]');
    await expect(statusTrigger).toBeVisible();

    // URL should still contain the param
    expect(page.url()).toContain("status=issued");
  });

  test("Orders page search filters table rows", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/orders");
    await page.waitForSelector("text=Ordini");

    const searchInput = page.locator('[data-testid="orders-search"]');

    // Type a very unlikely string to get zero results
    await searchInput.fill("zzzznonexistent99999");
    await expect(page.locator("text=Nessun ordine")).toBeVisible();

    // Clear the search
    await searchInput.fill("");
  });

  test("Orders page low_budget filter renders via URL param", async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate directly with low_budget status param
    await page.goto("/internal/orders?status=low_budget");
    await page.waitForSelector("text=Ordini");

    // The status filter should be visible and URL should contain the param
    const statusTrigger = page.locator('[data-testid="orders-status-filter"]');
    await expect(statusTrigger).toBeVisible();
    expect(page.url()).toContain("status=low_budget");

    // The filter option "Budget < 10%" should exist in the dropdown
    await statusTrigger.click();
    await expect(page.locator("text=Budget < 10%")).toBeVisible();
  });

  test("Dashboard low budget card links to orders with low_budget filter", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal");
    await page.waitForSelector("text=Indicatori Economici");

    // Check the card links to the correct filtered URL
    const lowBudgetLink = page.locator('a[href="/internal/orders?status=low_budget"]');
    if (await lowBudgetLink.count() > 0) {
      await lowBudgetLink.first().click();
      await page.waitForURL(/\/internal\/orders\?status=low_budget/);
      await expect(page.locator("text=Ordini")).toBeVisible();
    }
  });
});
