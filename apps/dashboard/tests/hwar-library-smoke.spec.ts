import { test, expect } from "@playwright/test";

test("hwar library smoke test", async ({ page }) => {
  // Navigate to library home
  await page.goto("/hwar/library");
  
  // Check that the Library page loads
  await expect(page.getByText("Library")).toBeVisible();
  
  // Test navigation to presets page
  await page.click('[data-testid="link-presets"]');
  await expect(page).toHaveURL(/.*\/hwar\/library\/presets/);
  
  // Check that the presets page loads (might be empty)
  await expect(page.getByText("Story Presets")).toBeVisible();
  
  // Test navigation to characters page
  await page.goto("/hwar/library");
  await page.click('[data-testid="link-characters"]');
  await expect(page).toHaveURL(/.*\/hwar\/library\/characters/);
  
  // Check that the characters page loads
  await expect(page.getByText("Characters")).toBeVisible();
  
  // Test navigation to datasets page
  await page.goto("/hwar/library");
  await page.click('[data-testid="link-datasets"]');
  await expect(page).toHaveURL(/.*\/hwar\/library\/datasets/);
  
  // Check that the datasets page loads
  await expect(page.getByText("Datasets")).toBeVisible();
});