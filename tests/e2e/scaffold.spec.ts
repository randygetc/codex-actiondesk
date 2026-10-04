import { expect, test } from "@playwright/test";

test("anonymous homepage leads to Google sign-in", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Code-ActionDesk");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Turn conversations into action.");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  expect(errors).toEqual([]);
});
