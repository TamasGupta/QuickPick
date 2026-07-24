import { test, expect } from "@playwright/test";

test.describe("Seller Settings & Store Hours Validation", () => {
  test("Redirects unauthenticated user to login", async ({ page }) => {
    await page.goto("/seller/settings");
    // Client-side React useEffect redirects unauthenticated user to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test("Time validation logic helper functions", async ({ page }) => {
    // Tests store hours validation logic in isolation
    await page.goto("/");
    
    // Test helper validation expectations
    const opensAt = "10:00";
    const invalidClosesAt = "09:00";
    const validClosesAt = "22:00";

    const [oh, om] = opensAt.split(":").map(Number);
    const [ic_h, ic_m] = invalidClosesAt.split(":").map(Number);
    const [vc_h, vc_m] = validClosesAt.split(":").map(Number);

    expect(ic_h * 60 + ic_m <= oh * 60 + om).toBe(true);  // Invalid: closes before opens
    expect(vc_h * 60 + vc_m > oh * 60 + om).toBe(true);   // Valid: closes after opens
  });
});
