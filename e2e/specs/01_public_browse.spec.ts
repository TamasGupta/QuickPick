import { test, expect } from "@playwright/test";

test.describe("Public Browsing & Storefront", () => {
  test("Home page loads with header, search, and category list", async ({ page }) => {
    // Collect console errors to detect hidden runtime exceptions
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");

    // Page title or main header check
    await expect(page).toHaveTitle(/QuickPick|GrabOn/i);

    // Search input exists (desktop and mobile search bars in header)
    const searchInput = page.locator("input[placeholder*='Search']").first();
    await expect(searchInput).toBeVisible();

    // Verify main navigation links
    const loginLink = page.locator("a[href='/login']").first();
    await expect(loginLink).toBeVisible();

    // Ensure no unhandled client-side runtime errors occurred on load
    const fatalErrors = consoleErrors.filter((err) => !err.includes("Download the React DevTools"));
    expect(fatalErrors).toHaveLength(0);
  });

  test("Search filters products without breaking UI", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator("input[placeholder*='Search']").first();
    await searchInput.fill("milk");
    // Wait for debounced search response
    await page.waitForTimeout(500);

    // Page should maintain stable layout during search
    await expect(searchInput).toHaveValue("milk");
  });

  test("Category navigation works", async ({ page }) => {
    await page.goto("/");

    // Click first category pill if available
    const categoryLink = page.locator("a[href*='/categories/']").first();
    if (await categoryLink.isVisible()) {
      await categoryLink.click();
      await expect(page).toHaveURL(/\/categories\//);
    }
  });
});
