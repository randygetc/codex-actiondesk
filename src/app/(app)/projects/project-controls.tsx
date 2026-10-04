"use client";
import { useActionState, useState } from "react";
import { archiveProject, deleteProject, type ProjectState } from "./actions";
const initial: ProjectState = { status: "idle", message: "" };

export function ProjectControls({ id, archived }: { id: string; archived: boolean }) {
  const [archiveState, archiveAction, archiving] = useActionState(archiveProject, initial);
  const [deleteState, deleteAction, deleting] = useActionState(deleteProject, initial);
  const [confirmed, setConfirmed] = useState(false);
  return <section className="mt-12 max-w-xl space-y-8 border-t pt-8" aria-label="Project management">
    <form action={archiveAction} className="space-y-3">
      <input type="hidden" name="id" value={id} /><input type="hidden" name="mode" value={archived ? "restore" : "archive"} />
      <p className="text-sm text-muted-foreground">Archived projects stay available but cannot be chosen for new tasks.</p>
      <button disabled={archiving} className="rounded-lg border px-4 py-2 disabled:opacity-50">{archiving ? "Updating…" : archived ? "Restore project" : "Archive project"}</button>
      {archiveState.message && <p role="alert">{archiveState.message}</p>}
    </form>
    <form action={deleteAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-muted-foreground">Deletion is permanent. Projects with tasks must be archived instead.</p>
      <label className="flex items-center gap-3"><input type="checkbox" name="confirmed" required checked={confirmed}
        onChange={(event) => setConfirmed(event.target.checked)} />Confirm permanent deletion</label>
      <button disabled={deleting || !confirmed} className="rounded-lg border px-4 py-2 text-destructive disabled:opacity-50">{deleting ? "Deleting…" : "Delete project"}</button>
      {deleteState.message && <p role="alert">{deleteState.message}</p>}
    </form>
  </section>;
}
