import { test, expect } from "@playwright/test";

test("hwar mounts", async ({ page }) => {
  await page.goto("/hwar");
  await expect(page.getByText("HelloWhoAreYou · Overview")).toBeVisible();
});
