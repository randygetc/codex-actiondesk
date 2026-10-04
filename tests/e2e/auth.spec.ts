import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { expect, test } from "@playwright/test";
import type { Database } from "../../src/lib/database.types";

test("anonymous users cannot access protected pages", async ({ page }) => {
  for (const route of ["/tasks", "/projects", "/settings"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  }
});
test("callback failure stays on the trusted origin", async ({ page }) => {
  await page.goto("/auth/callback?next=//evil.example");
  await expect(page).toHaveURL("http://127.0.0.1:3100/login?error=sign_in_failed");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Sign-in failed. Please try again.");
});
test("profile defaults, timezone persistence/rejection, and sign-out", async ({ page, context }) => {
  const jar = new Map<string, string>();
  // Public-key local Auth fixture, never an application login endpoint or admin client.
  const supabase = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
      },
    });
  const { data, error } = await supabase.auth.signUp({
    email: `playwright-${randomUUID()}@example.test`, password: randomUUID(),
    options: { data: { full_name: "Browser Test User", timezone: "Invalid/Zone" } },
  });
  if (error || !data.session) throw new Error("Local Auth fixture could not establish a session.");
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: "http://127.0.0.1:3100" })));
  await page.goto("/");
  await expect(page).toHaveURL(/\/tasks$/);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByText("Signed in as Browser Test User")).toBeVisible();
  await expect(page.getByLabel("Timezone", { exact: true })).toHaveValue("America/Los_Angeles");
  await page.getByLabel("Timezone", { exact: true }).fill("Asia/Manila");
  await page.getByRole("button", { name: "Save timezone" }).click();
  await expect(page.getByRole("status")).toHaveText("Timezone saved.");
  await page.reload();
  await expect(page.getByLabel("Timezone", { exact: true })).toHaveValue("Asia/Manila");
  await page.getByLabel("Timezone", { exact: true }).fill("Invalid/Zone");
  await page.getByRole("button", { name: "Save timezone" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("valid IANA timezone");
  await page.reload();
  await expect(page.getByLabel("Timezone", { exact: true })).toHaveValue("Asia/Manila");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?next=/);
});
