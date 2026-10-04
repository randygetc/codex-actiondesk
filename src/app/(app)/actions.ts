"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { signOutInputSchema } from "@/lib/validation/auth";

export async function signOut(formData: FormData) {
  signOutInputSchema.parse(Object.fromEntries(
    [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION_")),
  ));
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) redirect("/login?error=sign_out_failed");
  redirect("/login");
}
