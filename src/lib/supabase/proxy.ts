import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { logEvent } from "@/lib/logger";
import { getSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        const previousCookies = response.cookies.getAll();
        const cacheHeaders = ["cache-control", "pragma", "expires"].map(
          (name) => [name, response.headers.get(name)] as const,
        );
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        previousCookies.forEach((cookie) => response.cookies.set(cookie));
        cacheHeaders.forEach(([name, value]) => {
          if (value) response.headers.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // Repository policy requires getUser(). Route/action authorization remains separate.
  const { error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") {
    logEvent("auth.refresh_failed", { feature: "auth", outcome: "failure" });
  }
  return response;
}
