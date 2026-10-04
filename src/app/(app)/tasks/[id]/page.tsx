import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { taskIdSchema } from "@/lib/validation/tasks";
import { localInput, displayDue } from "@/lib/tasks/dates";
import { TaskForm, TaskControls } from "../task-form";
export default async function TaskPage({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { supabase, user } = await requireUser("/tasks");
    const { id } = await params;
    if (!taskIdSchema.safeParse(id).success)
        notFound();
    const [{ data: task }, { data: profile }, { data: projects }] = await Promise.all([supabase.from("tasks").select("*").eq("id", id).eq("user_id", user.id).single(), supabase.from("profiles").select("timezone").eq("id", user.id).single(), supabase.from("projects").select("id,name,archived_at").eq("user_id", user.id)]);
    if (!task)
        notFound();
    if (!profile)
        throw new Error("Profile unavailable.");
    return <main><Link href="/tasks" className="underline">All tasks</Link><h1 className="mt-4 text-3xl font-semibold">{task.title}</h1><p>{displayDue(task.due_at, profile.timezone)}</p><p>Current status: {task.status}</p><p className="whitespace-pre-wrap">{task.notes}</p>{task.recurrence && <p>Repeats in {task.recurrence_timezone}: {task.recurrence}</p>}<TaskForm task={task} localDue={localInput(task.due_at, profile.timezone)} timezone={profile.timezone} projects={(projects ?? []).filter(p => !p.archived_at || p.id === task.project_id).map(p => ({ ...p, name: p.name + (p.archived_at ? " (archived)" : "") }))}/><TaskControls id={id} status={task.status}/></main>;
}
