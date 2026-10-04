import { NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { authCodeSchema, safeDestination } from "@/lib/validation/auth";

// Auth session establishment only; business mutations remain Server Actions.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = authCodeSchema.safeParse(params.get("code"));
  let destination = "/login?error=sign_in_failed";
  if (code.success && !params.has("error")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code.data);
    if (!error) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (user && !userError) destination = safeDestination(params.get("next"));
    }
  }
  const response = NextResponse.redirect(new URL(destination, getAppOrigin()), 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
