import { expect, test } from "@playwright/test";

test("public scaffold renders without privileged credentials", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("ActionDesk");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Turn conversations into action.");
  await expect(page.getByText("ActionDesk is under construction.", { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});
