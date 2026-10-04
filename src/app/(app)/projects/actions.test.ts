import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProject, updateProject, archiveProject, deleteProject, type ProjectState } from "./actions";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), revalidatePath: vi.fn(), redirect: vi.fn(),
  from: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
const id = "21000000-0000-4000-8000-000000000001";
const initial: ProjectState = { status: "idle", message: "" };
function form(values: Record<string, string>) {
  const data = new FormData(); Object.entries(values).forEach(([key, value]) => data.set(key, value)); return data;
}
beforeEach(() => {
  mocks.requireUser.mockResolvedValue({ user: { id: "verified-owner" }, supabase: { from: mocks.from } });
  const query = { insert: mocks.insert, update: mocks.update, delete: mocks.delete, eq: mocks.eq, select: mocks.select, single: mocks.single };
  for (const mock of [mocks.from, mocks.insert, mocks.update, mocks.delete, mocks.eq, mocks.select]) mock.mockReturnValue(query);
  mocks.single.mockResolvedValue({ data: { id }, error: null });
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
});
describe("project actions", () => {
  it("creates a project using verified ownership and redirects to it", async () => {
    await expect(createProject(initial, form({ name: "  Launch ", user_id: "forged-owner" }))).rejects.toThrow(`redirect:/projects/${id}`);
    expect(mocks.insert).toHaveBeenCalledWith({ name: "Launch", description: "", user_id: "verified-owner" });
  });
  it("rejects invalid input before database writes", async () => {
    expect((await createProject(initial, form({ name: "   " }))).status).toBe("error");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("filters updates by both identity and verified owner, excluding submitted ownership", async () => {
    expect((await updateProject(initial, form({ id, name: "Edited", user_id: "forged-owner" }))).status).toBe("success");
    expect(mocks.update).toHaveBeenCalledWith({ name: "Edited", description: "" });
    expect(mocks.eq).toHaveBeenCalledWith("id", id);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "verified-owner");
  });
  it("does not expose nonexistent/foreign update details", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: "private database detail" } });
    expect(await updateProject(initial, form({ id, name: "Edited" }))).toEqual({ status: "error", message: "Project unavailable or could not be updated." });
  });
  it("archives using a server timestamp and restores with null", async () => {
    await expect(archiveProject(initial, form({ id, mode: "archive" }))).rejects.toThrow("redirect:/projects");
    expect(mocks.update).toHaveBeenCalledWith({ archived_at: expect.stringMatching(/^\d{4}-.*Z$/) });
    await expect(archiveProject(initial, form({ id, mode: "restore" }))).rejects.toThrow("redirect:/projects");
    expect(mocks.update).toHaveBeenLastCalledWith({ archived_at: null });
  });
  it("does not delete without explicit confirmation", async () => {
    expect((await deleteProject(initial, form({ id }))).status).toBe("error");
    expect(mocks.delete).not.toHaveBeenCalled();
  });
  it("handles reference conflicts without bypassing the database", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: "23503", message: "private references" } });
    expect((await deleteProject(initial, form({ id, confirmed: "on" }))).message).toBe("This project is still referenced. Archive it instead.");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("deletes only within the verified owner scope", async () => {
    await expect(deleteProject(initial, form({ id, confirmed: "on", user_id: "forged-owner" }))).rejects.toThrow("redirect:/projects");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "verified-owner");
  });
  it.each([createProject, updateProject, archiveProject, deleteProject])("reauthorizes every mutation", async (action) => {
    mocks.requireUser.mockRejectedValue(new Error("unauthorized"));
    await expect(action(initial, form({ id, name: "Launch", mode: "archive", confirmed: "on" }))).rejects.toThrow("unauthorized");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
