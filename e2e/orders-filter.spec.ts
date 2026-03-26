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

  test("Dashboard card navigates to orders with active filter", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal");
    await page.waitForSelector("text=Contratti attivi");

    const contractCard = page.locator('a[href="/internal/orders?status=active"]').first();
    await expect(contractCard).toBeVisible();
    await contractCard.click();
    await page.waitForURL(/\/internal\/orders\?status=active/);
    await expect(page.locator("text=Ordini")).toBeVisible();
  });

  test("Orders page renders search input and status filter", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/orders");

    const searchInput = page.locator('[data-testid="orders-search"]');
    await expect(searchInput).toBeVisible();

    const statusFilter = page.locator('[data-testid="orders-status-filter"]');
    await expect(statusFilter).toBeVisible();
  });

  test("Orders KPI cards are visible and clickable", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/orders");
    await page.waitForSelector("text=Ordini");

    // All 4 KPI cards should be visible
    await expect(page.locator('[data-testid="orders-kpi-active"]')).toBeVisible();
    await expect(page.locator('[data-testid="orders-kpi-pending_approval"]')).toBeVisible();
    await expect(page.locator('[data-testid="orders-kpi-draft"]')).toBeVisible();
    await expect(page.locator('[data-testid="orders-kpi-low_budget"]')).toBeVisible();

    // Click "Attivi" KPI card to apply filter
    await page.locator('[data-testid="orders-kpi-active"]').click();
    expect(page.url()).toContain("status=active");

    // Click again to toggle off
    await page.locator('[data-testid="orders-kpi-active"]').click();
    expect(page.url()).not.toContain("status=active");
  });

  test("Active filter excludes completed (fully billed) orders", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/orders?status=active");
    await page.waitForSelector("text=Ordini");

    // Active filter should only show in_progress/issued/accepted orders
    // and NOT show "Completato" badges
    const completedBadges = page.locator("text=Completato");
    const completedCount = await completedBadges.count();
    expect(completedCount).toBe(0);
  });

  test("Active KPI count matches dashboard count", async ({ page }) => {
    await loginAsAdmin(page);

    // Get count from dashboard card
    await page.goto("/internal");
    await page.waitForSelector("text=Contratti attivi");
    const dashboardCard = page.locator('a[href="/internal/orders?status=active"]').first();
    const dashboardCountText = await dashboardCard.locator("p.text-2xl").textContent();
    const dashboardCount = parseInt(dashboardCountText?.trim() || "0", 10);

    // Get count from orders page KPI card
    await page.goto("/internal/orders");
    await page.waitForSelector('[data-testid="orders-kpi-active"]');
    const ordersCountText = await page.locator('[data-testid="orders-kpi-active"] p.text-2xl').textContent();
    const ordersCount = parseInt(ordersCountText?.trim() || "0", 10);

    // They should match
    expect(ordersCount).toBe(dashboardCount);
  });

  test("Orders page search filters table rows", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/orders");
    await page.waitForSelector("text=Ordini");

    const searchInput = page.locator('[data-testid="orders-search"]');
    await searchInput.fill("zzzznonexistent99999");
    await expect(page.locator("text=Nessun ordine")).toBeVisible();
    await searchInput.fill("");
  });

  test("Orders page low_budget filter renders via URL param", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/orders?status=low_budget");
    await page.waitForSelector("text=Ordini");

    const statusTrigger = page.locator('[data-testid="orders-status-filter"]');
    await expect(statusTrigger).toBeVisible();
    expect(page.url()).toContain("status=low_budget");

    await statusTrigger.click();
    await expect(page.locator("text=Budget < 10%")).toBeVisible();
  });

  test("Dashboard low budget card links to orders with low_budget filter", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal");
    await page.waitForSelector("text=Indicatori Economici");

    const lowBudgetLink = page.locator('a[href="/internal/orders?status=low_budget"]');
    if (await lowBudgetLink.count() > 0) {
      await lowBudgetLink.first().click();
      await page.waitForURL(/\/internal\/orders\?status=low_budget/);
      await expect(page.locator("text=Ordini")).toBeVisible();
    }
  });
});
