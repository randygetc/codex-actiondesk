"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { projectFieldsSchema, projectUpdateSchema, projectArchiveSchema, projectDeleteSchema } from "@/lib/validation/projects";

export type ProjectState = { status: "idle" | "error" | "success"; message: string };
function refreshProjects(id?: string) {
  revalidatePath("/projects");
  if (id) revalidatePath(`/projects/${id}`);
}
export async function createProject(_previous: ProjectState, form: FormData): Promise<ProjectState> {
  const { supabase, user } = await requireUser("/projects");
  const parsed = projectFieldsSchema.safeParse({ name: form.get("name"), description: form.get("description") ?? "" });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const { data, error } = await supabase.from("projects").insert({ ...parsed.data, user_id: user.id }).select("id").single();
  if (error || !data) return { status: "error", message: "Your project could not be created. Please try again." };
  refreshProjects();
  redirect(`/projects/${data.id}`);
}
export async function updateProject(_previous: ProjectState, form: FormData): Promise<ProjectState> {
  const { supabase, user } = await requireUser("/projects");
  const parsed = projectUpdateSchema.safeParse({ id: form.get("id"), name: form.get("name"), description: form.get("description") ?? "" });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const { id, ...fields } = parsed.data;
  const { data, error } = await supabase.from("projects").update(fields).eq("id", id).eq("user_id", user.id).select("id").single();
  if (error || !data) return { status: "error", message: "Project unavailable or could not be updated." };
  refreshProjects(id);
  return { status: "success", message: "Project saved." };
}
export async function archiveProject(_previous: ProjectState, form: FormData): Promise<ProjectState> {
  const { supabase, user } = await requireUser("/projects");
  const parsed = projectArchiveSchema.safeParse({ id: form.get("id"), mode: form.get("mode") });
  if (!parsed.success) return { status: "error", message: "Invalid project or archive operation." };
  const { data, error } = await supabase.from("projects").update({
    archived_at: parsed.data.mode === "archive" ? new Date().toISOString() : null,
  }).eq("id", parsed.data.id).eq("user_id", user.id).select("id").single();
  if (error || !data) return { status: "error", message: "Project unavailable or could not be changed." };
  refreshProjects(parsed.data.id);
  redirect("/projects");
}
export async function deleteProject(_previous: ProjectState, form: FormData): Promise<ProjectState> {
  const { supabase, user } = await requireUser("/projects");
  const parsed = projectDeleteSchema.safeParse({ id: form.get("id"), confirmed: form.get("confirmed") });
  if (!parsed.success) return { status: "error", message: "Confirm permanent deletion of a valid project first." };
  // Task FKs in step 1.7 must restrict deletion; never cascade referenced tasks.
  const { data, error } = await supabase.from("projects").delete().eq("id", parsed.data.id).eq("user_id", user.id).select("id").single();
  if (error || !data) return { status: "error", message: error?.code === "23503"
    ? "This project is still referenced. Archive it instead."
    : "Project unavailable or could not be deleted." };
  refreshProjects(parsed.data.id);
  redirect("/projects");
}
