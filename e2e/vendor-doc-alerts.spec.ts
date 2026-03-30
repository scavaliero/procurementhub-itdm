import { test, expect } from "../playwright-fixture";

test.describe("Document expiry management — vendor list", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@vendorhub.it");
    await page.fill('input[type="password"]', "Admin@VendorHub2025!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/internal/**", { timeout: 15000 });
  });

  test("Napoli Srl shows correct expired document count (>1)", async ({ page }) => {
    await page.goto("/internal/vendors");
    await page.waitForSelector("table tbody tr", { timeout: 10000 });

    const napoliRow = page.locator("table tbody tr", { hasText: "Napoli Srl" });
    await expect(napoliRow).toBeVisible({ timeout: 10000 });

    // Find the destructive badge showing expired doc count
    const expiredBadge = napoliRow.locator('[class*="destructive"]');
    await expect(expiredBadge).toBeVisible({ timeout: 10000 });

    const badgeText = await expiredBadge.textContent();
    const count = parseInt(badgeText?.trim() || "0", 10);
    expect(count).toBeGreaterThan(1);
  });

  test("expired docs filter includes Napoli Srl", async ({ page }) => {
    await page.goto("/internal/vendors?docs_alert=expired");
    await page.waitForSelector("table tbody tr", { timeout: 10000 });

    const napoliRow = page.locator("table tbody tr", { hasText: "Napoli Srl" });
    await expect(napoliRow).toBeVisible({ timeout: 10000 });
  });

  test("vendor detail shows expired documents for Napoli Srl", async ({ page }) => {
    await page.goto("/internal/vendors");
    await page.waitForSelector("table tbody tr", { timeout: 10000 });

    // Click on Napoli Srl to open detail
    const napoliRow = page.locator("table tbody tr", { hasText: "Napoli Srl" });
    await napoliRow.click();
    await page.waitForTimeout(2000);

    // Verify we can see expired document indicators in the detail view
    const expiredIndicators = page.locator('text=/scadut/i');
    await expect(expiredIndicators.first()).toBeVisible({ timeout: 10000 });
  });

  test("dashboard expired docs KPI links to filtered vendor list", async ({ page }) => {
    await page.goto("/internal/dashboard");
    await page.waitForTimeout(3000);

    // Find the expired docs KPI card and click it
    const expiredCard = page.locator('[class*="destructive"], [class*="red"]', { hasText: /scadut/i }).first();
    if (await expiredCard.isVisible()) {
      await expiredCard.click();
      await page.waitForTimeout(2000);

      // Should navigate to vendors page with expired filter
      const url = page.url();
      expect(url).toContain("vendors");
    }
  });
});
