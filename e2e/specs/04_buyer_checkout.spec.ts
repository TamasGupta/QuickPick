import { test, expect } from "@playwright/test";

test.describe("Cart & Checkout Flow UI", () => {
  test("Cart displays empty state when cart has no items", async ({ page }) => {
    await page.goto("/cart");
    const emptyMsg = page.locator("text=/Your cart is empty|empty/i").first();
    await expect(emptyMsg).toBeVisible();
  });

  test("Checkout page redirects unauthenticated buyer to login", async ({ page }) => {
    await page.goto("/checkout");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });
});
