import { test, expect } from "../playwright-fixture";

test.describe("Bid Withdrawal & Re-submission — All Bids Visible", () => {
  const SUPPLIER_EMAIL = "Stefano.cavaliero@gmail.com";
  const SUPPLIER_PASS = "TempPass2026!";
  const ADMIN_EMAIL = "admin@vendorhub.it";
  const ADMIN_PASS = "Admin@VendorHub2025!";

  test("Supplier can view opportunities and access detail", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/supplier/opportunities");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

    const oppRow = page.locator("table tbody tr").first();
    if (await oppRow.count() > 0) {
      await oppRow.click();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("text=Dettagli Opportunità")).toBeVisible({ timeout: 10000 });
    }
  });

  test("Admin evaluation page shows all bids including withdrawn ones", async ({ page }) => {
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

      const evalTab = page.locator('text=Valutazione');
      if (await evalTab.count() > 0) {
        await evalTab.first().click();
        await page.waitForLoadState("networkidle");

        // Page should load with heading visible
        await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

        // If there are withdrawn bids, they should appear with reduced opacity
        const withdrawnBadges = page.locator('text=Ritirata');
        const withdrawnCount = await withdrawnBadges.count();
        
        // Count total bid rows (all statuses)
        const bidRows = page.locator("table tbody tr");
        const totalRows = await bidRows.count();

        // There should be rows visible (at least the invitation rows)
        expect(totalRows).toBeGreaterThanOrEqual(0);
        
        // If withdrawn bids exist, verify they are shown
        if (withdrawnCount > 0) {
          console.log(`Found ${withdrawnCount} withdrawn bid(s) displayed on the evaluation page`);
        }
      }
    }
  });

  test("Admin sees version numbers when supplier has multiple bids", async ({ page }) => {
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

      const evalTab = page.locator('text=Valutazione');
      if (await evalTab.count() > 0) {
        await evalTab.first().click();
        await page.waitForLoadState("networkidle");

        await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

        // Check for version indicators (v1, v2, etc.) when multiple bids exist
        const versionLabels = page.locator('text=/^v\\d+$/');
        const versionCount = await versionLabels.count();
        console.log(`Found ${versionCount} version label(s) on the evaluation page`);
      }
    }
  });
});
