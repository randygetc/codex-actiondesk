import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";

// Test infrastructure only: discover local public settings without printing keys.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  try {
    const local = JSON.parse(execFileSync("supabase", ["status", "--output", "json"], {
      stdio: ["ignore", "pipe", "pipe"], encoding: "utf8",
    }));
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= local.API_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||= local.PUBLISHABLE_KEY || local.ANON_KEY;
  } catch { throw new Error("Start local Supabase or set public Supabase environment variables before browser tests."); }
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Browser tests require the local public Supabase URL and publishable key.");
}
const fixtureUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (!["127.0.0.1", "localhost"].includes(fixtureUrl.hostname) || fixtureUrl.port !== "55321") {
  throw new Error("Auth fixture tests target only ActionDesk's local Supabase on port 55321.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Build with the same local test settings used at runtime; .env.local may target another stack.
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      APP_URL: "http://127.0.0.1:3100",
    },
  },
});
