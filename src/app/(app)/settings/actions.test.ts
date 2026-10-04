import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateTimezone, type TimezoneState } from "./actions";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), revalidatePath: vi.fn(), from: vi.fn(),
  update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
const initial: TimezoneState = { status: "idle", message: "" };
function input(zone: string) { const form = new FormData(); form.set("timezone", zone); return form; }
beforeEach(() => {
  mocks.requireUser.mockResolvedValue({ user: { id: "verified-owner" }, supabase: { from: mocks.from } });
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ single: mocks.single });
  mocks.single.mockResolvedValue({ data: { id: "verified-owner" }, error: null });
});
describe("timezone Server Action", () => {
  it("derives identity from getUser-backed authorization, ignoring forged owner fields", async () => {
    const form = input("Asia/Manila"); form.set("id", "foreign-owner");
    expect((await updateTimezone(initial, form)).status).toBe("success");
    expect(mocks.update).toHaveBeenCalledWith({ timezone: "Asia/Manila" });
    expect(mocks.eq).toHaveBeenCalledWith("id", "verified-owner");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings");
  });
  it("rejects invalid input before any database write", async () => {
    expect((await updateTimezone(initial, input("Invalid/Zone"))).status).toBe("error");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("reauthorizes every request, including after sign-out", async () => {
    mocks.requireUser.mockRejectedValue(new Error("unauthorized"));
    await expect(updateTimezone(initial, input("UTC"))).rejects.toThrow("unauthorized");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("reports denied or missing updates without exposing raw database errors", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: "private database details" } });
    const result = await updateTimezone(initial, input("UTC"));
    expect(result.status).toBe("error");
    expect(result.message).not.toContain("private database details");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
