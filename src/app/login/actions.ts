"use server";
import { redirect } from "next/navigation";
import { getAppOrigin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { oauthInputSchema, safeDestination } from "@/lib/validation/auth";

export async function signInWithGoogle(formData: FormData) {
  const { next } = oauthInputSchema.parse({ next: safeDestination(formData.get("next")) });
  const callback = new URL("/auth/callback", getAppOrigin());
  callback.searchParams.set("next", next);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google", options: {
      redirectTo: callback.toString(), skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect(`/login?error=sign_in_failed&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}
