import { z } from "zod";

const configSchema = z.object({
  url: z.url(),
  publishableKey: z.string().trim().min(1),
});

export function getSupabaseConfig() {
  const parsed = configSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!parsed.success) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  return parsed.data;
}
