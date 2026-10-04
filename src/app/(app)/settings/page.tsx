import { requireUser } from "@/lib/auth";
import { TimezoneForm } from "./timezone-form";

export default async function SettingsPage() {
  const { supabase, user } = await requireUser("/settings");
  const { data: profile, error } = await supabase.from("profiles")
    .select("display_name, timezone").eq("id", user.id).single();
  return <main><h1 className="text-3xl font-semibold">Settings</h1>
    {error || !profile ? <p role="alert" className="mt-6">Your profile could not be loaded. Please try again.</p> : <>
      <p className="mt-6">Signed in as {profile.display_name}</p><TimezoneForm timezone={profile.timezone} />
    </>}
  </main>;
}
