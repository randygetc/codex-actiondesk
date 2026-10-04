import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="mx-auto min-h-screen max-w-5xl px-6 py-8">
    <header className="mb-12 flex flex-wrap items-center justify-between gap-6 border-b pb-6">
      <Link href="/tasks" className="text-xl font-semibold text-primary">Code-ActionDesk</Link>
      <nav aria-label="Main navigation" className="flex items-center gap-6">
        <Link href="/tasks">Tasks</Link><Link href="/projects">Projects</Link><Link href="/settings">Settings</Link>
        <form action={signOut}><button className="rounded-lg border px-3 py-2">Sign out</button></form>
      </nav>
    </header>{children}
  </div>;
}
