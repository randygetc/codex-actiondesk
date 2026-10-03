import { CheckSquare2 } from "lucide-react";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <div className="mb-8 flex items-center gap-3 text-primary">
        <CheckSquare2 aria-hidden="true" className="size-8" />
        <span className="text-xl font-semibold">ActionDesk</span>
      </div>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Turn conversations into action.
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
        Bring your meeting notes, review the action items, and keep your work moving.
      </p>
      <p className="mt-10 text-sm text-muted-foreground">
        ActionDesk is under construction. Sign-in and task tracking are coming next.
      </p>
    </main>
  );
}
