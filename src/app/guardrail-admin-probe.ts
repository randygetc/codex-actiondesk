"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// Deliberate step 1.4 violation. Never merge or invoke this action.
export async function guardrailAdminProbe() {
  return Boolean(createAdminClient());
}
