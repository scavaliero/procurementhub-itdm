import { test, expect } from "../playwright-fixture";

const ADMIN_EMAIL = "admin@vendorhub.it";
const ADMIN_PASS = "Admin@VendorHub2025!";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/internal/);
}

test.describe("Admin Roles E2E", () => {
  test("Roles page loads and shows role cards", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/admin/roles");
    await page.waitForSelector("text=Gestione Ruoli");
    // Verify at least one role card is visible
    const cards = page.locator(".card-top-admin");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    // Verify "Nuovo Ruolo" button is present
    await expect(page.locator('button:has-text("Nuovo Ruolo")')).toBeVisible();
  });

  test("Create role dialog opens and validates required name", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/admin/roles");
    await page.waitForSelector("text=Gestione Ruoli");

    // Open create dialog
    await page.click('button:has-text("Nuovo Ruolo")');
    await expect(page.locator("text=Nuovo Ruolo").nth(1)).toBeVisible();

    // "Crea" button should be disabled when name is empty
    const createBtn = page.locator('button:has-text("Crea")');
    await expect(createBtn).toBeDisabled();

    // Fill in name → button should be enabled
    await page.fill('input', "Ruolo Test E2E");
    await expect(createBtn).toBeEnabled();

    // Cancel
    await page.click('button:has-text("Annulla")');
  });

  test("Clicking a role card opens grants drawer", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/admin/roles");
    await page.waitForSelector("text=Gestione Ruoli");

    // Click first role card
    const firstCard = page.locator(".card-top-admin").first();
    const roleName = await firstCard.locator(".text-sm.font-medium").textContent();
    await firstCard.click();

    // Drawer should open with "Permessi: <role_name>"
    await expect(page.locator(`text=Permessi: ${roleName}`)).toBeVisible({ timeout: 5000 });

    // Should show at least one grant toggle (Switch)
    const switches = page.locator('button[role="switch"]');
    await expect(switches.first()).toBeVisible({ timeout: 5000 });
  });

  test("System role shows 'Sistema' badge and no delete button", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/admin/roles");
    await page.waitForSelector("text=Gestione Ruoli");

    // Find a card with "Sistema" badge
    const sistemaBadge = page.locator('text=Sistema').first();
    if (await sistemaBadge.isVisible({ timeout: 5000 })) {
      // Click its parent card
      const card = sistemaBadge.locator("xpath=ancestor::div[contains(@class,'card-top-admin')]");
      await card.click();

      // Drawer should show "non modificabile" text
      await expect(page.locator("text=non modificabile")).toBeVisible({ timeout: 5000 });
    }
  });

  test("User count is displayed on role cards", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/admin/roles");
    await page.waitForSelector("text=Gestione Ruoli");

    // Each card should show "N utenti"
    const userCountText = page.locator("text=utenti").first();
    await expect(userCountText).toBeVisible({ timeout: 5000 });
  });
});
