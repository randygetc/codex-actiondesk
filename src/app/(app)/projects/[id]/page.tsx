import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { projectIdSchema } from "@/lib/validation/projects";
import { ProjectForm } from "../project-form";
import { ProjectControls } from "../project-controls";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser("/projects");
  const parsed = projectIdSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const { data: project, error } = await supabase.from("projects").select("id, name, description, archived_at")
    .eq("id", parsed.data).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Project could not be loaded.");
  if (!project) notFound();
  return <main><Link href="/projects" className="text-primary">Back to projects</Link>
    <h1 className="mt-6 break-words text-3xl font-semibold">{project.name}</h1>
    {project.archived_at && <p className="mt-4 text-muted-foreground">Archived project</p>}
    <ProjectForm key={project.id} project={project} /><ProjectControls id={project.id} archived={Boolean(project.archived_at)} />
  </main>;
}
