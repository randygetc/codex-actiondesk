import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// The public scaffold needs no credentials; these become authenticated routes in step 1.5.
export const config = {
  matcher: ["/tasks/:path*", "/projects/:path*", "/settings/:path*", "/auth/:path*"],
};
