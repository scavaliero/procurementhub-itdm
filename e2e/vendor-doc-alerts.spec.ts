import { test, expect } from "../playwright-fixture";

test.describe("Vendor list — document alert counts", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@vendorhub.it");
    await page.fill('input[type="password"]', "Admin@VendorHub2025!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/internal/**", { timeout: 15000 });
  });

  test("Napoli Srl shows correct expired document count (not just 1)", async ({ page }) => {
    await page.goto("/internal/vendors");
    await page.waitForSelector("table tbody tr", { timeout: 10000 });

    // Find the row for Napoli Srl
    const napoliRow = page.locator("table tbody tr", { hasText: "Napoli Srl" });
    await expect(napoliRow).toBeVisible({ timeout: 10000 });

    // The "Doc. scaduti" column is the 4th column (index 3)
    const expiredCell = napoliRow.locator("td").nth(3);
    const expiredBadge = expiredCell.locator('[class*="destructive"]');

    // Should have a destructive badge showing expired docs
    await expect(expiredBadge).toBeVisible({ timeout: 10000 });

    // The count should be greater than 1 (Napoli Srl has multiple expired docs)
    const badgeText = await expiredBadge.textContent();
    const count = parseInt(badgeText?.trim() || "0", 10);
    expect(count).toBeGreaterThan(1);
  });

  test("expired docs filter shows Napoli Srl", async ({ page }) => {
    await page.goto("/internal/vendors?docs_alert=expired");
    await page.waitForSelector("table tbody tr", { timeout: 10000 });

    const napoliRow = page.locator("table tbody tr", { hasText: "Napoli Srl" });
    await expect(napoliRow).toBeVisible({ timeout: 10000 });
  });
});
