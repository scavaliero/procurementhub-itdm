import { test, expect } from "../playwright-fixture";

test.describe("Purchasing Flow E2E", () => {
  const ADMIN_EMAIL = "admin@vendorhub.it";
  const ADMIN_PASS = "Admin@VendorHub2025!";

  async function loginAsAdmin(page: import("@playwright/test").Page) {
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/internal/, { timeout: 15000 });
  }

  test("Sidebar shows purchasing section with correct links", async ({ page }) => {
    await loginAsAdmin(page);

    // Check sidebar items
    await expect(page.locator("text=Le mie richieste")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Da validare")).toBeVisible();
    await expect(page.locator("text=Pannello Acquisti")).toBeVisible();
    await expect(page.locator("text=Acquisti Diretti")).toBeVisible();

    // Click "Le mie richieste" and verify URL
    await page.click("text=Le mie richieste");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/internal/purchasing/requests");
    expect(page.url()).toContain("view=mine");

    // Click "Da validare" and verify URL
    await page.click("text=Da validare");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/internal/purchasing/requests");
    expect(page.url()).toContain("view=validate");
  });

  test("Purchase requests list page renders with filters", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/purchasing/requests");
    await page.waitForLoadState("networkidle");

    // Page heading visible
    await expect(page.locator("text=Richieste di Acquisto").first()).toBeVisible({ timeout: 10000 });

    // Search input exists
    await expect(page.locator('input[placeholder*="Cerca"]')).toBeVisible();

    // Status filter select exists
    await expect(page.locator("text=Tutti gli stati").first()).toBeVisible();

    // New request button visible (admin has create_purchase_request)
    await expect(page.locator("text=Nuova richiesta")).toBeVisible();
  });

  test("?view=mine filter works on list page", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/purchasing/requests?view=mine");
    await page.waitForLoadState("networkidle");

    // Page should load without errors
    await expect(page.locator("text=Richieste di Acquisto").first()).toBeVisible({ timeout: 10000 });
  });

  test("?view=validate filter works on list page", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/purchasing/requests?view=validate");
    await page.waitForLoadState("networkidle");

    // Page should load without errors
    await expect(page.locator("text=Richieste di Acquisto").first()).toBeVisible({ timeout: 10000 });
  });

  test("Create new purchase request draft and submit", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/purchasing/requests/new");
    await page.waitForLoadState("networkidle");

    // Fill form
    await expect(page.locator("text=Nuova Richiesta di Acquisto")).toBeVisible({ timeout: 10000 });

    await page.fill('input[placeholder="Oggetto della richiesta"]', "Test E2E - Acquisto materiale ufficio");
    await page.fill('textarea[placeholder*="Perché"]', "Necessario per operatività reparto - test automatico E2E");
    
    // Fill amount
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill("1500");

    // Save draft
    await page.click("text=Salva bozza");
    await page.waitForLoadState("networkidle");

    // Check that toast appears
    await expect(page.locator("text=Bozza salvata")).toBeVisible({ timeout: 10000 });

    // URL should now have draft param
    await page.waitForTimeout(1000);
    expect(page.url()).toContain("draft=");

    // Now submit: click "Invia richiesta"
    await page.click("text=Invia richiesta");
    await page.waitForLoadState("networkidle");

    // Confirm dialog should appear
    await expect(page.locator("text=Conferma invio")).toBeVisible({ timeout: 5000 });
    await page.click("text=Conferma invio");
    await page.waitForLoadState("networkidle");

    // Should redirect to list
    await expect(page.locator("text=Richiesta inviata")).toBeVisible({ timeout: 10000 });
  });

  test("Purchase request detail page loads", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/purchasing/requests");
    await page.waitForLoadState("networkidle");

    // Check if there's at least one row in the table
    const firstRow = page.locator("table tbody tr").first();
    const rowCount = await firstRow.count();
    
    if (rowCount > 0) {
      await firstRow.click();
      await page.waitForLoadState("networkidle");

      // Detail page should show the request info
      await expect(page.locator("text=Torna alla lista")).toBeVisible({ timeout: 10000 });
      await expect(page.locator("text=Storico")).toBeVisible();
    }
  });

  test("KPI cards visible for validator/operator", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/purchasing/requests");
    await page.waitForLoadState("networkidle");

    // Admin has validator + operator grants, so KPIs should show
    await expect(page.locator("text=In attesa")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Approvate (mese)")).toBeVisible();
    await expect(page.locator("text=Importo mese")).toBeVisible();
  });

  test("Direct purchases page loads", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/purchasing/direct");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Acquisti Diretti").first()).toBeVisible({ timeout: 10000 });
  });

  test("Purchase panel page loads", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/internal/purchasing/panel");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Pannello Acquisti").first()).toBeVisible({ timeout: 10000 });
  });
});
