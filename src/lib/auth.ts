import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { appOriginSchema, safeDestination } from "@/lib/validation/auth";

export function getAppOrigin() {
  return new URL(appOriginSchema.parse(process.env.APP_URL)).origin;
}
export async function requireUser(next: string = "/tasks") {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect(`/login?next=${encodeURIComponent(safeDestination(next))}`);
  return { supabase, user };
}
