"use client";
import { useActionState, useState } from "react";
import { createProject, updateProject, type ProjectState } from "./actions";

const initial: ProjectState = { status: "idle", message: "" };
export function ProjectForm({ project }: { project?: { id: string; name: string; description: string } }) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [state, action, pending] = useActionState(project ? updateProject : createProject, initial);
  return <form action={action} className="mt-6 max-w-xl space-y-4">
    {project && <input type="hidden" name="id" value={project.id} />}
    <div><label htmlFor="project-name" className="block font-medium">Project name</label>
      <input id="project-name" name="name" value={name} onChange={(event) => setName(event.target.value)}
        required maxLength={120} className="mt-2 w-full rounded-lg border bg-background px-3 py-2" /></div>
    <div><label htmlFor="project-description" className="block font-medium">Description (optional)</label>
      <textarea id="project-description" name="description" value={description} onChange={(event) => setDescription(event.target.value)}
        maxLength={2000} rows={4} className="mt-2 w-full rounded-lg border bg-background px-3 py-2" /></div>
    <button disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
      {pending ? "Saving…" : project ? "Save project" : "Create project"}
    </button>
    {state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
  </form>;
}
