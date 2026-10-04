import { beforeEach, expect, it, vi } from "vitest";
import { saveTask, changeTaskStatus, deleteTask } from "./actions";
const m = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), single: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), eq: vi.fn(), select: vi.fn(), rpc: vi.fn(), redirect: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
const id = "32000000-0000-4000-8000-000000000001";
function form(values: Record<string, string>) { const f = new FormData(); for (const [k, v] of Object.entries(values))
    f.set(k, v); return f; }
const fields = { title: "Task", notes: "", priority: "normal", project_id: "", due_local: "", offset: "", recurrence: "" };
beforeEach(() => { const q = { single: m.single, insert: m.insert, update: m.update, delete: m.delete, eq: m.eq, select: m.select }; for (const fn of [m.from, m.insert, m.update, m.delete, m.eq, m.select])
    fn.mockReturnValue(q); m.auth.mockResolvedValue({ user: { id: "verified-user" }, supabase: { from: m.from, rpc: m.rpc } }); m.single.mockResolvedValue({ data: { id, timezone: "UTC" }, error: null }); m.rpc.mockResolvedValue({ data: null, error: null }); m.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); }); });
it.each([saveTask, changeTaskStatus, deleteTask])("reauthenticates mutations", async (action) => { m.auth.mockRejectedValue(new Error("Unauthorized")); await expect(action({ message: "" }, form(fields))).rejects.toThrow("Unauthorized"); expect(m.from).not.toHaveBeenCalled(); });
it("rejects malformed task before database use", async () => { expect((await saveTask({ message: "" }, form({ ...fields, title: " " }))).error).toBe(true); expect(m.from).not.toHaveBeenCalled(); });
it("derives owner and never accepts submitted status", async () => { await expect(saveTask({ message: "" }, form({ ...fields, user_id: "forged", status: "done" }))).rejects.toThrow("NEXT_REDIRECT"); expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "verified-user", title: "Task" })); expect(m.insert.mock.calls[0][0]).not.toHaveProperty("status"); });
it("rejects recurring tasks without due dates", async () => { expect((await saveTask({ message: "" }, form({ ...fields, recurrence: "FREQ=DAILY" }))).message).toContain("due date"); expect(m.insert).not.toHaveBeenCalled(); });
it("requires delete confirmation", async () => { expect((await deleteTask({ message: "" }, form({ id }))).error).toBe(true); expect(m.delete).not.toHaveBeenCalled(); });
it("keeps database errors private", async () => { m.single.mockResolvedValue({ data: null, error: { message: "secret" } }); expect((await deleteTask({ message: "" }, form({ id, confirmed: "on" }))).message).not.toContain("secret"); });
it("recalculates on stale completion revision", async () => { m.single.mockResolvedValue({ data: { id, revision: 2, recurrence: "FREQ=DAILY;COUNT=2", recurrence_anchor: "2026-10-01T09:00", recurrence_timezone: "UTC", due_at: "2026-10-01T09:00:00Z", occurrence: 1 }, error: null }); m.rpc.mockResolvedValueOnce({ error: { code: "40001" } }).mockResolvedValue({ data: id, error: null }); expect((await changeTaskStatus({ message: "" }, form({ id, status: "done" }))).error).toBeUndefined(); expect(m.rpc).toHaveBeenCalledTimes(2); expect(m.rpc).toHaveBeenLastCalledWith("complete_task", { p_id: id, p_revision: 2, p_next: "2026-10-02T09:00:00Z" }); });
it("reports completion failure without claiming it saved", async () => { m.single.mockResolvedValue({ data: { id, revision: 1 }, error: null }); m.rpc.mockResolvedValue({ error: { code: "23514", message: "secret" } }); expect((await changeTaskStatus({ message: "" }, form({ id, status: "done" }))).message).toBe("Completion failed; no changes were saved."); });
