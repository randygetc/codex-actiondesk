import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

// Supabase start/status include privileged local credentials. Capture both streams;
// publish only the public settings needed by the test app, never raw CLI output.
try {
  execFileSync("supabase", ["start"], { stdio: ["ignore", "pipe", "pipe"], timeout: 600_000 });
  const local = JSON.parse(execFileSync("supabase", ["status", "--output", "json"], {
    stdio: ["ignore", "pipe", "pipe"], encoding: "utf8",
  }));
  const url = new URL(local.API_URL);
  const key = local.PUBLISHABLE_KEY || local.ANON_KEY;
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "55321" ||
      typeof key !== "string" || !key || /[\r\n]/.test(key)) {
    throw new Error("Unexpected local test settings.");
  }
  if (process.env.GITHUB_ENV) {
    process.stdout.write(`::add-mask::${key}\n`);
    appendFileSync(process.env.GITHUB_ENV,
      `NEXT_PUBLIC_SUPABASE_URL=${url.origin}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\nAPP_URL=http://127.0.0.1:3100\n`);
  }
  process.stdout.write("Local test Supabase is ready on port 55321.\n");
} catch {
  // Do not expose an exec error: its stdout/stderr can contain keys or credentials.
  process.stderr.write("Local test Supabase could not start or provide valid settings. Check the committed config and Docker availability.\n");
  process.exitCode = 1;
}
