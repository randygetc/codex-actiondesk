import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { ProjectForm } from "./project-form";
export default async function ProjectsPage() {
  const { supabase, user } = await requireUser("/projects");
  const { data, error } = await supabase.from("projects").select("id, name, description, archived_at")
    .eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) throw new Error("Projects could not be loaded.");
  const projects = data ?? [];
  return <main><h1 className="text-3xl font-semibold">Projects</h1>
    <section className="mt-8" aria-labelledby="new-project"><h2 id="new-project" className="text-xl font-semibold">New project</h2><ProjectForm /></section>
    {[{ title: "Active projects", archived: false }, { title: "Archived projects", archived: true }].map(({ title, archived }) => {
      const rows = projects.filter((project) => Boolean(project.archived_at) === archived);
      return <section key={title} aria-label={title} className="mt-12">
        <h2 className="text-xl font-semibold">{title}</h2>
        {rows.length === 0 ? <p className="mt-4 text-muted-foreground">{archived ? "No archived projects." : "No active projects yet. Create your first project above."}</p>
          : <ul className="mt-4 space-y-3">{rows.map((project) => <li key={project.id} className="rounded-lg border p-4">
            <Link href={`/projects/${project.id}`} className="break-words font-medium text-primary">{project.name}</Link>
            {project.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{project.description}</p>}
          </li>)}</ul>}
      </section>;
    })}
  </main>;
}
