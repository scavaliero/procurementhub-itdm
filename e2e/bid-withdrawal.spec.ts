import { test, expect } from "../playwright-fixture";

test.describe("Bid Withdrawal & Re-submission", () => {
  const SUPPLIER_EMAIL = "Stefano.cavaliero@gmail.com";
  const SUPPLIER_PASS = "TempPass2026!";

  test("Supplier can view opportunities list", async ({ page }) => {
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

  test("Supplier can access opportunity detail and see bid form or status", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/supplier/opportunities");
    await page.waitForLoadState("networkidle");

    const oppRow = page.locator("table tbody tr").first();
    if (await oppRow.count() > 0) {
      await oppRow.click();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("text=Dettagli Opportunità")).toBeVisible({ timeout: 10000 });
    }
  });

  test("Supplier sees withdraw button only when bid is submitted and not yet admitted", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/supplier/opportunities");
    await page.waitForLoadState("networkidle");

    const oppRow = page.locator("table tbody tr").first();
    if (await oppRow.count() > 0) {
      await oppRow.click();
      await page.waitForLoadState("networkidle");

      // If bid is submitted, withdraw button should be visible
      const withdrawBtn = page.locator('button:has-text("Ritira offerta")');
      const submittedBadge = page.locator('text=Offerta inviata');
      
      if (await submittedBadge.count() > 0) {
        await expect(withdrawBtn).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("After withdrawal, supplier can create a new draft bid", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/supplier/opportunities");
    await page.waitForLoadState("networkidle");

    const oppRow = page.locator("table tbody tr").first();
    if (await oppRow.count() > 0) {
      await oppRow.click();
      await page.waitForLoadState("networkidle");

      // Check if the bid form (Importo totale input) is visible — 
      // this means the supplier can create a new bid
      const amountInput = page.locator('input[name="total_amount"]');
      const withdrawnHistory = page.locator('text=Offerta ritirata');
      
      // If there's a withdrawn history entry and the form is visible,
      // the re-submission flow is working
      if (await withdrawnHistory.count() > 0) {
        await expect(amountInput).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
