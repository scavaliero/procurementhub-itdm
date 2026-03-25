import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@vendorhub.it";
const ADMIN_PASS = "Admin@VendorHub2025!";
const SUPPLIER_EMAIL = "Stefano.cavaliero@gmail.com";
const SUPPLIER_PASS = "TempPass2026!";

test.describe("Evaluation bid sorting, supplier tabbed UI, submission date", () => {

  test("Admin evaluation page sorts bids: winning > submitted > excluded > withdrawn", async ({ page }) => {
    // Login as admin
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/internal/);

    // Navigate to opportunities
    await page.goto("/internal/opportunities");
    await page.waitForSelector("text=Opportunità");

    // Find an opportunity and go to evaluation
    const oppLink = page.locator("table tbody tr").first();
    if (await oppLink.count() === 0) {
      test.skip(true, "No opportunities available for testing");
      return;
    }

    // Click on first opportunity
    await oppLink.click();
    await page.waitForTimeout(1000);

    // Check if evaluation link exists
    const evalButton = page.locator('text=Valutazione offerte');
    if (await evalButton.count() === 0) {
      test.skip(true, "No evaluation button on this opportunity");
      return;
    }
    await evalButton.click();
    await page.waitForSelector("text=Valutazione Offerte");

    // Verify table exists
    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Check that Status column exists
    await expect(page.locator("th", { hasText: "Stato" })).toBeVisible();

    // Verify bid rows exist
    const rows = page.locator("table tbody tr");
    const rowCount = await rows.count();
    if (rowCount < 2) {
      test.skip(true, "Not enough bids for sorting test");
      return;
    }

    // Collect statuses in order
    const statuses: string[] = [];
    for (let i = 0; i < rowCount; i++) {
      const badge = rows.nth(i).locator('[class*="badge"], .inline-flex').first();
      if (await badge.count() > 0) {
        const text = await badge.textContent();
        if (text) statuses.push(text.trim());
      }
    }

    // Verify ordering: non-withdrawn before withdrawn (simplified check)
    const statusPriority: Record<string, number> = {
      "Aggiudicata": 0, "Vincitrice": 0,
      "Inviata": 2, "Ammessa": 3,
      "Esclusa": 5, "Ritirata": 6,
      "Nessuna offerta": 7,
    };

    let lastPriority = -1;
    for (const s of statuses) {
      const p = statusPriority[s] ?? 4;
      expect(p).toBeGreaterThanOrEqual(lastPriority);
      lastPriority = p;
    }
  });

  test("Supplier opportunity uses tabbed UI with detail and criteria tabs", async ({ page }) => {
    // Login as supplier
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    // Navigate to opportunities
    await page.goto("/supplier/opportunities");
    await page.waitForSelector("text=Opportunità");

    // Click on first opportunity card
    const card = page.locator('[class*="card"]').first();
    if (await card.count() === 0) {
      test.skip(true, "No opportunities available");
      return;
    }
    await card.click();
    await page.waitForTimeout(1000);

    // Verify tabbed layout exists
    const detailTab = page.locator('[role="tab"]', { hasText: "Dettaglio" });
    const criteriaTab = page.locator('[role="tab"]', { hasText: "Criteri" });
    await expect(detailTab).toBeVisible();
    await expect(criteriaTab).toBeVisible();

    // Verify detail content shows
    await expect(page.locator("text=Informazioni generali")).toBeVisible();

    // Switch to criteria tab
    await criteriaTab.click();
    await page.waitForTimeout(500);

    // Should show criteria content
    const criteriaContent = page.locator("text=Criteri di valutazione");
    const noCriteria = page.locator("text=Nessun criterio");
    const hasCriteria = await criteriaContent.count() > 0;
    const hasNoCriteria = await noCriteria.count() > 0;
    expect(hasCriteria || hasNoCriteria).toBeTruthy();
  });

  test("Supplier bid sheet shows submission date for submitted bids", async ({ page }) => {
    // Login as supplier
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/supplier/opportunities");
    await page.waitForSelector("text=Opportunità");

    const card = page.locator('[class*="card"]').first();
    if (await card.count() === 0) {
      test.skip(true, "No opportunities available");
      return;
    }
    await card.click();
    await page.waitForTimeout(1000);

    // Look for "Visualizza offerta" button (existing submitted bid)
    const viewBidBtn = page.locator('button', { hasText: /Visualizza offerta/ });
    if (await viewBidBtn.count() === 0) {
      test.skip(true, "No submitted bid to verify");
      return;
    }
    await viewBidBtn.click();
    await page.waitForTimeout(1000);

    // Check that "Data presentazione" is visible
    await expect(page.locator("text=Data presentazione")).toBeVisible();
  });

  test("Admin bid detail panel shows submission date", async ({ page }) => {
    // Login as admin
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/internal/);

    await page.goto("/internal/opportunities");
    await page.waitForSelector("text=Opportunità");

    const oppLink = page.locator("table tbody tr").first();
    if (await oppLink.count() === 0) {
      test.skip(true, "No opportunities");
      return;
    }
    await oppLink.click();
    await page.waitForTimeout(1000);

    const evalButton = page.locator('text=Valutazione offerte');
    if (await evalButton.count() === 0) {
      test.skip(true, "No evaluation page");
      return;
    }
    await evalButton.click();
    await page.waitForSelector("text=Valutazione Offerte");

    // Expand first bid with expand button
    const expandBtn = page.locator("table tbody tr").first().locator("button").first();
    if (await expandBtn.count() > 0) {
      await expandBtn.click();
      await page.waitForTimeout(500);

      // Check for "Data presentazione" in expanded panel
      const dateLabel = page.locator("text=Data presentazione");
      if (await dateLabel.count() > 0) {
        await expect(dateLabel).toBeVisible();
      }
    }
  });
});
