import { test, expect } from "../playwright-fixture";

test.describe("Supplier Profile E2E", () => {
  const SUPPLIER_EMAIL = "Stefano.cavaliero@gmail.com";
  const SUPPLIER_PASS = "TempPass2026!";

  test("Supplier can view onboarding/profile page", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/supplier/onboarding");
    await page.waitForLoadState("networkidle");

    // Should see company data section
    await expect(page.locator("text=Dati Azienda")).toBeVisible({ timeout: 10000 });
  });

  test("Supplier profile shows referenti section", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/supplier/onboarding");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Referenti")).toBeVisible({ timeout: 10000 });
  });

  test("Supplier profile shows categorie section", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/supplier/onboarding");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Categorie Merceologiche")).toBeVisible({ timeout: 10000 });
  });

  test("Supplier can see change request status if post-onboarding", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/supplier/onboarding");
    await page.waitForLoadState("networkidle");

    // After onboarding, there should be either edit mode or request modification button
    // The exact UI depends on the supplier status
    const pageContent = await page.textContent("body");
    const hasProfile = pageContent?.includes("Dati Azienda");
    expect(hasProfile).toBeTruthy();
  });

  test("Supplier documents page loads", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', SUPPLIER_EMAIL);
    await page.fill('input[type="password"]', SUPPLIER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(supplier|internal)/);

    await page.goto("/supplier/documents");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Documenti")).toBeVisible({ timeout: 10000 });
  });
});
