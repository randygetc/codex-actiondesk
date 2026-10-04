import { beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithGoogle } from "./actions";
const mocks = vi.hoisted(() => ({ oauth: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAppOrigin: () => "http://127.0.0.1:3000" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signInWithOAuth: mocks.oauth } }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
beforeEach(() => {
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
  mocks.oauth.mockResolvedValue({ data: { url: "https://supabase.example/auth/v1/authorize" }, error: null });
});
describe("Google sign-in action", () => {
  it("requests Google's account chooser with a trusted callback and approved next destination", async () => {
    const form = new FormData(); form.set("next", "/settings");
    await expect(signInWithGoogle(form)).rejects.toThrow("redirect:https://supabase.example");
    expect(mocks.oauth).toHaveBeenCalledWith({ provider: "google", options: {
      redirectTo: "http://127.0.0.1:3000/auth/callback?next=%2Fsettings", skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    } });
  });
  it("handles provider failures with a safe destination and generic message", async () => {
    mocks.oauth.mockResolvedValue({ data: { url: null }, error: new Error("secret provider detail") });
    const form = new FormData(); form.set("next", "//evil.example");
    await expect(signInWithGoogle(form)).rejects.toThrow("redirect:/login?error=sign_in_failed&next=%2Ftasks");
  });
});
