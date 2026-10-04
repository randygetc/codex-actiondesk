import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Refresh cookies before pages/actions independently authorize with getUser().
export const config = {
  matcher: ["/", "/login", "/tasks/:path*", "/projects/:path*", "/settings/:path*", "/auth/:path*"],
};
