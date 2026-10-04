import { requireUser } from "@/lib/auth";
export default async function TasksPage() {
  await requireUser("/tasks");
  return <main><h1 className="text-3xl font-semibold">Tasks</h1>
    <p className="mt-4 text-muted-foreground">Task tracking is coming in the next foundation steps.</p></main>;
}
