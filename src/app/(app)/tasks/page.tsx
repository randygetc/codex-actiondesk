import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { taskGroup, displayDue } from "@/lib/tasks/dates";
import { TaskForm } from "./task-form";
export default async function TasksPage() {
    const { supabase, user } = await requireUser("/tasks");
    const [{ data: profile }, { data: tasks, error }, { data: projects }] = await Promise.all([
        supabase.from("profiles").select("timezone").eq("id", user.id).single(),
        supabase.from("tasks").select("*").eq("user_id", user.id).order("due_at", { ascending: true, nullsFirst: false }).order("id"),
        supabase.from("projects").select("id,name").eq("user_id", user.id).is("archived_at", null).order("name")
    ]);
    if (error || !profile)
        throw new Error("Tasks unavailable.");
    const now = new Date().toISOString();
    return <main><h1 className="text-3xl font-semibold">Tasks</h1><h2 className="mt-6 text-xl">New task</h2><TaskForm projects={projects ?? []} timezone={profile.timezone}/>
 {["Overdue", "Today", "This week", "Later", "No due date", "Completed"].map(group => <section key={group} className="my-6"><h2 className="text-xl font-semibold">{group}</h2><ul>{(tasks ?? []).filter(t => taskGroup(t, profile.timezone, now) === group).map(t => <li key={t.id} className="my-2 rounded border p-3"><Link href={`/tasks/${t.id}`} className="font-medium underline">{t.title}</Link><p>{t.status} · {t.priority} · {displayDue(t.due_at, profile.timezone)}</p></li>)}</ul>{!(tasks ?? []).some(t => taskGroup(t, profile.timezone, now) === group) && <p className="text-muted-foreground">No tasks.</p>}</section>)}
 </main>;
}
