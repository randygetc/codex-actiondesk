import { beforeEach, describe, expect, it, vi } from "vitest";
import { signOut } from "./actions";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), signOut: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
beforeEach(() => {
  mocks.requireUser.mockResolvedValue({ supabase: { auth: { signOut: mocks.signOut } } });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
});
describe("sign-out action", () => {
  it("reauthorizes and signs out the current device", async () => {
    await expect(signOut(new FormData())).rejects.toThrow("redirect:/login");
    expect(mocks.requireUser).toHaveBeenCalledOnce();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("does not report success when sign-out fails", async () => {
    mocks.signOut.mockResolvedValue({ error: new Error("private upstream detail") });
    await expect(signOut(new FormData())).rejects.toThrow("redirect:/login?error=sign_out_failed");
  });
});
