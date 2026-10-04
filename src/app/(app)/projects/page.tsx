import { requireUser } from "@/lib/auth";
export default async function ProjectsPage() {
  await requireUser("/projects");
  return <main><h1 className="text-3xl font-semibold">Projects</h1>
    <p className="mt-4 text-muted-foreground">Project tracking is coming in the next foundation steps.</p></main>;
}
