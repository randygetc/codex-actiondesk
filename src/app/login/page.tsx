import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeDestination } from "@/lib/validation/auth";
import { signInWithGoogle } from "./actions";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeDestination(params.next);
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (user && !error && params.error !== "sign_out_failed") redirect(next);
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
    <p className="text-lg font-semibold text-primary">ActionDesk</p>
    <h1 className="mt-6 text-4xl font-semibold tracking-tight">Turn conversations into action.</h1>
    <p className="mt-4 text-muted-foreground">Sign in to manage your work and preferences.</p>
    {params.error && <p role="alert" className="mt-6 text-destructive">
      {params.error === "sign_out_failed" ? "Sign-out failed. Please try again." : "Sign-in failed. Please try again."}
    </p>}
    <form action={signInWithGoogle} className="mt-8">
      <input type="hidden" name="next" value={next} />
      <button className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground">Continue with Google</button>
    </form>
  </main>;
}
