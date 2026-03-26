import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@vendorhub.it";
const ADMIN_PASS = "Admin@VendorHub2025!";
const SUPPLIER_EMAIL = "Stefano.cavaliero@gmail.com";
const SUPPLIER_PASS = "TempPass2026!";

async function login(page, email: string, password: string) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(internal|supplier)\//, { timeout: 15000 });
}

test.describe("Internal portal — all sidebar & breadcrumb links", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASS);
  });

  const internalPages = [
    { name: "Dashboard", path: "/internal/dashboard" },
    { name: "Fornitori", path: "/internal/vendors" },
    { name: "Opportunità", path: "/internal/opportunities" },
    { name: "Ordini", path: "/internal/orders" },
    { name: "Benestare", path: "/internal/billing-approvals" },
    { name: "Tipi Documento", path: "/internal/config/document-types" },
    { name: "Categorie", path: "/internal/config/categories" },
    { name: "Ruoli", path: "/internal/admin/roles" },
    { name: "Utenti", path: "/internal/admin/users" },
    { name: "Audit Log", path: "/internal/admin/audit-logs" },
    { name: "Richieste Acquisto", path: "/internal/purchasing/requests" },
    { name: "Pannello Acquisti", path: "/internal/purchasing/panel" },
    { name: "Acquisti Diretti", path: "/internal/purchasing/direct" },
    { name: "Nuova Opportunità", path: "/internal/opportunities/new" },
    { name: "Nuova RDA", path: "/internal/purchasing/requests/new" },
    { name: "Nuovo Acquisto Diretto", path: "/internal/purchasing/direct/new" },
    { name: "Profilo", path: "/internal/profile" },
    { name: "Cambio Password", path: "/internal/change-password" },
    { name: "Notifiche", path: "/internal/notifications" },
  ];

  for (const pg of internalPages) {
    test(`${pg.name} (${pg.path}) loads without 404`, async ({ page }) => {
      await page.goto(pg.path);
      await page.waitForLoadState("networkidle");
      // Must NOT show 404 page
      const is404 = await page.locator("text=404").count();
      expect(is404, `Page ${pg.path} shows 404`).toBe(0);
      // Must still be on an internal path (not redirected to login)
      expect(page.url()).toContain("/internal");
    });
  }

  test("Dashboard breadcrumb link works from Opportunità page", async ({ page }) => {
    await page.goto("/internal/opportunities");
    await page.waitForLoadState("networkidle");
    const dashLink = page.locator('nav[aria-label="Breadcrumb"] a', { hasText: "Dashboard" });
    await expect(dashLink).toHaveAttribute("href", "/internal/dashboard");
    await dashLink.click();
    await page.waitForURL("**/internal/dashboard", { timeout: 5000 });
    expect(page.url()).toContain("/internal/dashboard");
  });
});

test.describe("Supplier portal — all sidebar links", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, SUPPLIER_EMAIL, SUPPLIER_PASS);
  });

  const supplierPages = [
    { name: "Dashboard", path: "/supplier/dashboard" },
    { name: "Profilo Onboarding", path: "/supplier/onboarding" },
    { name: "Documenti", path: "/supplier/documents" },
    { name: "Opportunità", path: "/supplier/opportunities" },
    { name: "Ordini", path: "/supplier/orders" },
    { name: "Benestare", path: "/supplier/billing-approvals" },
    { name: "Notifiche", path: "/supplier/notifications" },
    { name: "Profilo", path: "/supplier/profile" },
    { name: "Cambio Password", path: "/supplier/change-password" },
  ];

  for (const pg of supplierPages) {
    test(`${pg.name} (${pg.path}) loads without 404`, async ({ page }) => {
      await page.goto(pg.path);
      await page.waitForLoadState("networkidle");
      const is404 = await page.locator("text=404").count();
      expect(is404, `Page ${pg.path} shows 404`).toBe(0);
      expect(page.url()).toContain("/supplier");
    });
  }
});
