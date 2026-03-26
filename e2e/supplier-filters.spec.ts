import { test, expect } from "@playwright/test";

const SUPPLIER_EMAIL = "Stefano.cavaliero@gmail.com";
const SUPPLIER_PASS = "TempPass2026!";

async function loginAsSupplier(page: any) {
  await page.goto("/login");
  await page.fill('input[type="email"]', SUPPLIER_EMAIL);
  await page.fill('input[type="password"]', SUPPLIER_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/supplier/);
}

test.describe("Supplier pages KPI cards and filters", () => {

  // ── Opportunities ──────────────────────────────────────────

  test("Opportunities page shows KPI cards", async ({ page }) => {
    await loginAsSupplier(page);
    await page.goto("/supplier/opportunities");
    await page.waitForSelector("text=Opportunità");

    await expect(page.locator('[data-testid="opp-kpi-all"]')).toBeVisible();
    await expect(page.locator('[data-testid="opp-kpi-unseen"]')).toBeVisible();
    await expect(page.locator('[data-testid="opp-kpi-open"]')).toBeVisible();
    await expect(page.locator('[data-testid="opp-kpi-evaluating"]')).toBeVisible();
  });

  test("Opportunities KPI card filters list", async ({ page }) => {
    await loginAsSupplier(page);
    await page.goto("/supplier/opportunities");
    await page.waitForSelector('[data-testid="opp-kpi-open"]');

    await page.locator('[data-testid="opp-kpi-open"]').click();
    expect(page.url()).toContain("status=open");

    // Click again to toggle off
    await page.locator('[data-testid="opp-kpi-open"]').click();
    expect(page.url()).not.toContain("status=open");
  });

  test("Opportunities search filters results", async ({ page }) => {
    await loginAsSupplier(page);
    await page.goto("/supplier/opportunities");
    await page.waitForSelector("text=Opportunità");

    const search = page.locator('[data-testid="opp-search"]');
    await expect(search).toBeVisible();
    await search.fill("zzzznonexistent99999");
    await expect(page.locator("text=Nessuna opportunità")).toBeVisible();
  });

  // ── Orders ─────────────────────────────────────────────────

  test("Orders page shows KPI cards", async ({ page }) => {
    await loginAsSupplier(page);
    await page.goto("/supplier/orders");
    await page.waitForSelector("text=Ordini ricevuti");

    await expect(page.locator('[data-testid="sup-orders-kpi-to_action"]')).toBeVisible();
    await expect(page.locator('[data-testid="sup-orders-kpi-in_progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="sup-orders-kpi-accepted"]')).toBeVisible();
    await expect(page.locator('[data-testid="sup-orders-kpi-completed"]')).toBeVisible();
  });

  test("Orders KPI card filters list", async ({ page }) => {
    await loginAsSupplier(page);
    await page.goto("/supplier/orders");
    await page.waitForSelector('[data-testid="sup-orders-kpi-in_progress"]');

    await page.locator('[data-testid="sup-orders-kpi-in_progress"]').click();
    expect(page.url()).toContain("status=in_progress");

    await page.locator('[data-testid="sup-orders-kpi-in_progress"]').click();
    expect(page.url()).not.toContain("status=in_progress");
  });

  test("Orders search and status filter are visible", async ({ page }) => {
    await loginAsSupplier(page);
    await page.goto("/supplier/orders");
    await page.waitForSelector("text=Ordini ricevuti");

    await expect(page.locator('[data-testid="sup-orders-search"]')).toBeVisible();
    await expect(page.locator('[data-testid="sup-orders-status-filter"]')).toBeVisible();
  });

  test("Orders search filters results", async ({ page }) => {
    await loginAsSupplier(page);
    await page.goto("/supplier/orders");
    await page.waitForSelector("text=Ordini ricevuti");

    const search = page.locator('[data-testid="sup-orders-search"]');
    await search.fill("zzzznonexistent99999");
    await expect(page.locator("text=Nessun ordine")).toBeVisible();
  });

  // ── Billing Approvals ──────────────────────────────────────

  test("Billing page shows KPI cards", async ({ page }) => {
    await loginAsSupplier(page);
    await page.goto("/supplier/billing-approvals");
    await page.waitForSelector("text=Benestare di Fatturazione");

    await expect(page.locator('[data-testid="sup-billing-kpi-all"]')).toBeVisible();
    await expect(page.locator('[data-testid="sup-billing-kpi-approved"]')).toBeVisible();
    await expect(page.locator('[data-testid="sup-billing-kpi-invoiced"]')).toBeVisible();
    await expect(page.locator('[data-testid="sup-billing-kpi-closed"]')).toBeVisible();
  });

  test("Billing KPI card filters list", async ({ page }) => {
    await loginAsSupplier(page);
    await page.goto("/supplier/billing-approvals");
    await page.waitForSelector('[data-testid="sup-billing-kpi-approved"]');

    await page.locator('[data-testid="sup-billing-kpi-approved"]').click();
    expect(page.url()).toContain("status=approved");

    await page.locator('[data-testid="sup-billing-kpi-approved"]').click();
    expect(page.url()).not.toContain("status=approved");
  });

  test("Billing search and status filter are visible", async ({ page }) => {
    await loginAsSupplier(page);
    await page.goto("/supplier/billing-approvals");
    await page.waitForSelector("text=Benestare di Fatturazione");

    await expect(page.locator('[data-testid="sup-billing-search"]')).toBeVisible();
    await expect(page.locator('[data-testid="sup-billing-status-filter"]')).toBeVisible();
  });

  // ── Documents ──────────────────────────────────────────────

  test("Documents page shows KPI cards", async ({ page }) => {
    await loginAsSupplier(page);
    await page.goto("/supplier/documents");
    await page.waitForSelector("text=Documenti");

    await expect(page.locator('[data-testid="sup-docs-kpi-approved"]')).toBeVisible();
    await expect(page.locator('[data-testid="sup-docs-kpi-pending"]')).toBeVisible();
    await expect(page.locator('[data-testid="sup-docs-kpi-rejected"]')).toBeVisible();
    await expect(page.locator('[data-testid="sup-docs-kpi-missing"]')).toBeVisible();
  });

  test("Documents KPI card filters list", async ({ page }) => {
    await loginAsSupplier(page);
    await page.goto("/supplier/documents");
    await page.waitForSelector('[data-testid="sup-docs-kpi-approved"]');

    await page.locator('[data-testid="sup-docs-kpi-approved"]').click();
    expect(page.url()).toContain("status=approved");

    await page.locator('[data-testid="sup-docs-kpi-approved"]').click();
    expect(page.url()).not.toContain("status=approved");
  });

  test("Documents search is visible and filters results", async ({ page }) => {
    await loginAsSupplier(page);
    await page.goto("/supplier/documents");
    await page.waitForSelector("text=Documenti");

    const search = page.locator('[data-testid="sup-docs-search"]');
    await expect(search).toBeVisible();
    await search.fill("zzzznonexistent99999");
    await expect(page.locator("text=Nessun documento")).toBeVisible();
  });
});
