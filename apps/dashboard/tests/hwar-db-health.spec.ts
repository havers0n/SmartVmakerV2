import { test, expect } from "@playwright/test";

test("hwar dev health", async ({ page }) => {
  await page.goto("/hwar/dev");
  await expect(page.getByText('"ok": true')).toBeVisible();
});
