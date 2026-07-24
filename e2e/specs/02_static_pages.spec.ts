import { test, expect } from "@playwright/test";

const STATIC_PAGES = [
  { path: "/about", title: /About/i },
  { path: "/contact", title: /Contact/i },
  { path: "/terms", title: /Terms/i },
  { path: "/privacy", title: /Privacy/i },
  { path: "/refund-policy", title: /Refund/i },
];

test.describe("Static Content & Policy Pages", () => {
  for (const pageInfo of STATIC_PAGES) {
    test(`Page ${pageInfo.path} loads cleanly without errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      const response = await page.goto(pageInfo.path);
      expect(response?.status()).toBe(200);

      // Ensure main content card/container is visible
      const bodyText = page.locator("body");
      await expect(bodyText).toBeVisible();

      // Ensure no 404 page content rendered
      const notFoundHeading = page.locator("h1:has-text('404')");
      await expect(notFoundHeading).not.toBeVisible();

      // Check for unhandled client-side runtime errors
      const fatalErrors = consoleErrors.filter((err) => !err.includes("React DevTools"));
      expect(fatalErrors).toHaveLength(0);
    });
  }
});
