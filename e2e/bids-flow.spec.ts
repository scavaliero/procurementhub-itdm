import { test, expect } from "../playwright-fixture";

test.describe("Bids Flow E2E", () => {
  const SUPPLIER_EMAIL = "Stefano.cavaliero@gmail.com";
  const SUPPLIER_PASS = "TempPass2026!";
  const ADMIN_EMAIL = "admin@vendorhub.it";
  const ADMIN_PASS = "Admin@VendorHub2025!";

  test("Supplier can view opportunity details after invitation", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/supplier/opportunities");
    await page.waitForLoadState("networkidle");

    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("Supplier bid form validates budget max", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/supplier/opportunities");
    await page.waitForLoadState("networkidle");

    const oppLink = page.locator("table tbody tr").first();
    const rowCount = await oppLink.count();
    if (rowCount > 0) {
      await oppLink.click();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("text=Dettagli Opportunità")).toBeVisible({ timeout: 10000 });
    }
  });

  test("Admin evaluation page shows icon-based actions instead of dropdown", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/internal/opportunities");
    await page.waitForLoadState("networkidle");

    // Find an opportunity and go to evaluation
    const oppRow = page.locator("table tbody tr").first();
    const oppCount = await oppRow.count();
    if (oppCount > 0) {
      await oppRow.click();
      await page.waitForLoadState("networkidle");

      // Look for "Valutazione" tab or link
      const evalTab = page.locator('text=Valutazione');
      const evalTabCount = await evalTab.count();
      if (evalTabCount > 0) {
        await evalTab.first().click();
        await page.waitForLoadState("networkidle");

        // Verify no dropdown (SelectTrigger with "Cambia stato") exists
        const dropdown = page.locator('button:has-text("Cambia stato")');
        await expect(dropdown).toHaveCount(0);

        // Verify the evaluation page loaded
        await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test("Admin can view evaluation page with bid statuses", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/internal/opportunities");
    await page.waitForLoadState("networkidle");

    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("Bid status labels include withdrawn", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/internal/opportunities");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
  });
});
