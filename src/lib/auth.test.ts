import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUser } from "./auth";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), createClient: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
beforeEach(() => {
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
});
describe("server authorization", () => {
  it("uses a verified getUser result", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "verified-owner" } }, error: null });
    expect((await requireUser()).user.id).toBe("verified-owner");
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });
  it("redirects anonymous users without trusting a session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireUser("/settings")).rejects.toThrow("redirect:/login?next=%2Fsettings");
  });
  it("fails closed even if getUser returns a user alongside an error", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "unverified" } }, error: new Error("failed") });
    await expect(requireUser("//evil.example")).rejects.toThrow("redirect:/login?next=%2Ftasks");
  });
});
