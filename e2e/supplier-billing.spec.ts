import { test, expect } from "../playwright-fixture";

test.describe("Supplier Billing Approvals", () => {
  const SUPPLIER_EMAIL = "Stefano.cavaliero@gmail.com";
  const SUPPLIER_PASS = "TempPass2026!";

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/, { timeout: 15000 });
  });

  test("Supplier can view billing approvals list", async ({ page }) => {
    await page.goto("/supplier/billing-approvals");
    await page.waitForLoadState("networkidle");

    const heading = page.locator("h1");
    await expect(heading).toContainText("Benestare", { timeout: 10000 });
  });

  test("Supplier can open billing approval detail", async ({ page }) => {
    await page.goto("/supplier/billing-approvals");
    await page.waitForLoadState("networkidle");

    // Check if there are any billing rows
    const detailButton = page.locator("button:has-text('Dettaglio')").first();
    const count = await detailButton.count();

    if (count > 0) {
      await detailButton.click();
      await page.waitForLoadState("networkidle");

      // Should navigate to detail page with billing data
      await expect(page).toHaveURL(/\/supplier\/billing-approvals\/.+/);

      // Detail page should show billing info cards
      await expect(page.locator("text=Dati benestare")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Ordine di riferimento")).toBeVisible({ timeout: 10000 });

      // Back button should return to list
      const backButton = page.locator("button").filter({ has: page.locator("svg.lucide-arrow-left") }).first();
      await backButton.click();
      await expect(page).toHaveURL(/\/supplier\/billing-approvals$/);
    } else {
      // No billings available — verify empty state is shown
      await expect(page.locator("text=Nessun benestare")).toBeVisible({ timeout: 10000 });
    }
  });
});
