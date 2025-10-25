import { test, expect } from "@playwright/test";

test("hwar mounts", async ({ page }) => {
  await page.goto("/hwar");
  // Check that the HWAR home page loads
  await expect(page.getByText("Video Generation Factory")).toBeVisible();
  
  // Test navigation to create page
  await page.click('[data-testid="card-create"]');
  await expect(page).toHaveURL(/.*\/hwar\/create/);
  
  // Test navigation back to home
  await page.goto("/hwar");
  await expect(page.getByText("Video Generation Factory")).toBeVisible();
});