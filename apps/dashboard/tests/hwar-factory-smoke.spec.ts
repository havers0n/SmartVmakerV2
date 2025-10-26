import { test, expect } from "@playwright/test";

test("hwar factory smoke test", async ({ page }) => {
  // Navigate to factory home
  await page.goto("/hwar/factory");
  
  // Check that the Factory Dashboard loads
  await expect(page.getByText("Factory Dashboard")).toBeVisible();
  
  // Test navigation to harvests page
  await page.click('[data-testid="link-harvests"]');
  await expect(page).toHaveURL(/.*\/hwar\/factory\/harvests/);
  
  // Check that the harvests page loads (might be empty)
  await expect(page.getByText("YouTube Harvests")).toBeVisible();
  
  // Test navigation to analysis page
  await page.goto("/hwar/factory");
  await page.click('[data-testid="link-analysis-queue"]');
  await expect(page).toHaveURL(/.*\/hwar\/factory\/analysis/);
  
  // Check that the analysis page loads
  await expect(page.getByText("Analysis Queue")).toBeVisible();
  
  // Test navigation to workers page
  await page.goto("/hwar/factory");
  await page.click('[data-testid="link-workers"]');
  await expect(page).toHaveURL(/.*\/hwar\/factory\/workers/);
  
  // Check that the workers page loads
  await expect(page.getByText("Workers")).toBeVisible();
});