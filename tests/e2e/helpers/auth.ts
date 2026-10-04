import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";
import type { Database } from "../../../src/lib/database.types";

export async function signInLocalFixture(context: BrowserContext) {
  const jar = new Map<string, string>();
  const supabase = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
      },
    });
  const { data, error } = await supabase.auth.signUp({
    email: `projects-${randomUUID()}@example.test`, password: randomUUID(),
    options: { data: { full_name: "Project Browser User" } },
  });
  if (error || !data.session || !data.user) throw new Error("Local Auth fixture could not establish a session.");
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: "http://127.0.0.1:3100" })));
  return { supabase, user: data.user };
}
