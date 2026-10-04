"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { requireUser } from "@/lib/auth";
import { taskFieldsSchema, taskIdSchema, taskStatusSchema, taskDeleteSchema } from "@/lib/validation/tasks";
import { localInput, nextOccurrence, parseRule, toInstant, validateAnchor } from "@/lib/tasks/dates";
export type TaskState = {
    message: string;
    error?: boolean;
};
const fail = (message: string): TaskState => ({ message, error: true });
function refresh(id?: string) { revalidatePath("/tasks"); revalidatePath("/projects"); if (id)
    revalidatePath(`/tasks/${id}`); }
export async function saveTask(_previous: TaskState, form: FormData): Promise<TaskState> {
    const { supabase, user } = await requireUser("/tasks");
    const id = form.get("id");
    if (id && !taskIdSchema.safeParse(id).success)
        return fail("Invalid task.");
    const parsed = taskFieldsSchema.safeParse({ ...Object.fromEntries(["title", "notes", "priority", "project_id", "due_local", "offset", "recurrence"].map(k => [k, form.get(k) ?? ""])), reset_schedule: form.get("reset_schedule") === "on" });
    if (!parsed.success)
        return fail(parsed.error.issues[0].message);
    const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();
    if (!profile)
        return fail("Profile unavailable.");
    const { data: existing } = id ? await supabase.from("tasks").select("*").eq("id", String(id)).eq("user_id", user.id).single() : { data: null };
    if (id && !existing)
        return fail("Task unavailable.");
    const v = parsed.data;
    let fields: Database["public"]["Tables"]["tasks"]["Update"];
    try {
        const unchanged = existing && v.due_local === localInput(existing.due_at, profile.timezone) && v.recurrence === (existing.recurrence ?? "") && !v.reset_schedule;
        if (existing && !unchanged && !v.reset_schedule)
            return fail("Confirm starting a new schedule before changing due date or recurrence.");
        const due_at = unchanged ? existing.due_at : v.due_local ? toInstant(v.due_local, profile.timezone, v.offset) : null;
        const recurrence = v.recurrence ? parseRule(v.recurrence).value : null;
        if (recurrence && !due_at)
            return fail("Recurring tasks need a due date.");
        if (recurrence && !unchanged)
            validateAnchor(recurrence, v.due_local, profile.timezone, due_at!);
        fields = { title: v.title, notes: v.notes, priority: v.priority, project_id: v.project_id,
            due_at, recurrence, recurrence_timezone: unchanged ? existing.recurrence_timezone : recurrence ? profile.timezone : null,
            recurrence_anchor: unchanged ? existing.recurrence_anchor : recurrence ? v.due_local : null,
            occurrence: unchanged ? existing.occurrence : 1 };
    } catch (error) {
        return fail(error instanceof Error ? error.message : "Invalid schedule.");
    }
    const result = existing
        ? await supabase.from("tasks").update(fields).eq("id", existing.id).eq("user_id", user.id).eq("revision", existing.revision).select("id").single()
        : await supabase.from("tasks").insert({ ...fields, title: parsed.data.title, user_id: user.id }).select("id").single();
    if (result.error || !result.data) {
        return fail("Task could not be saved. Its project may be archived, its schedule may have a successor, or another edit may have occurred.");
    }
    refresh(result.data.id);
    if (!existing) redirect(`/tasks/${result.data.id}`);
    return { message: "Task saved." };
}

export async function changeTaskStatus(_previous: TaskState, form: FormData): Promise<TaskState> {
    const { supabase, user } = await requireUser("/tasks");
    const parsed = taskStatusSchema.safeParse({ id: form.get("id"), status: form.get("status") });
    if (!parsed.success)
        return fail("Invalid status change.");
    for (let attempt = 0; attempt < 3; attempt++) {
        const { data: t } = await supabase.from("tasks").select("*").eq("id", parsed.data.id).eq("user_id", user.id).single();
        if (!t)
            return fail("Task unavailable.");
        if (parsed.data.status === "done") {
            let next: string | null = null;
            try {
                if (t.recurrence && t.recurrence_anchor && t.recurrence_timezone)
                    next = nextOccurrence(t.recurrence, t.recurrence_anchor, t.recurrence_timezone, t.occurrence, t.due_at!);
            }
            catch {
                return fail("Recurrence could not be calculated.");
            }
            // Supabase generated RPC arguments omit SQL nullability; null means no successor.
            const result = await supabase.rpc("complete_task", { p_id: t.id, p_revision: t.revision, p_next: next as string });
            if (result.error?.code === "40001")
                continue;
            if (result.error)
                return fail("Completion failed; no changes were saved.");
        }
        else {
            const result = await supabase.from("tasks").update({ status: parsed.data.status, completed_at: null }).eq("id", t.id).eq("user_id", user.id).eq("revision", t.revision).select("id").single();
            if (result.error || !result.data)
                continue;
        }
        refresh(t.id);
        return { message: "Task status saved." };
    }
    return fail("Task changed while saving. Please try again.");
}
export async function deleteTask(_previous: TaskState, form: FormData): Promise<TaskState> {
    const { supabase, user } = await requireUser("/tasks");
    const parsed = taskDeleteSchema.safeParse({ id: form.get("id"), confirmed: form.get("confirmed") });
    if (!parsed.success)
        return fail("Confirm permanent deletion first.");
    const { data, error } = await supabase.from("tasks").delete().eq("id", parsed.data.id).eq("user_id", user.id).select("id").single();
    if (error || !data)
        return fail("Task unavailable or has a successor. Keep its history instead.");
    refresh(parsed.data.id);
    redirect("/tasks");
}
