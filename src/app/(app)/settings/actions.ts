"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { profileTimezoneSchema } from "@/lib/validation/auth";

export type TimezoneState = { status: "idle" | "success" | "error"; message: string };
export async function updateTimezone(_previous: TimezoneState, formData: FormData): Promise<TimezoneState> {
  const { supabase, user } = await requireUser("/settings");
  const parsed = profileTimezoneSchema.safeParse({ timezone: formData.get("timezone") });
  if (!parsed.success) return { status: "error", message: "Enter a valid IANA timezone, such as America/Los_Angeles." };
  // Submitted identity is never used for ownership.
  const { data, error } = await supabase.from("profiles").update(parsed.data)
    .eq("id", user.id).select("id").single();
  if (error || !data) return { status: "error", message: "Your timezone could not be saved. Please try again." };
  revalidatePath("/settings");
  return { status: "success", message: "Timezone saved." };
}
