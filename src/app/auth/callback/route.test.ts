import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
const mocks = vi.hoisted(() => ({ exchange: vi.fn(), getUser: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAppOrigin: () => "http://127.0.0.1:3000" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
beforeEach(() => {
  mocks.createClient.mockResolvedValue({ auth: { exchangeCodeForSession: mocks.exchange, getUser: mocks.getUser } });
  mocks.exchange.mockResolvedValue({ error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null });
});
describe("OAuth callback", () => {
  it("exchanges code, verifies user and redirects to approved destination on trusted origin", async () => {
    const response = await GET(new Request("https://untrusted-host.example/auth/callback?code=test-code&next=/settings"));
    expect(mocks.exchange).toHaveBeenCalledWith("test-code");
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/settings");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("rejects protocol-relative redirect destinations", async () => {
    const response = await GET(new Request("http://127.0.0.1:3000/auth/callback?code=code&next=//evil.example"));
    expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/tasks");
  });
  it("does not exchange a code when the provider returned an error", async () => {
    const response = await GET(new Request("http://127.0.0.1:3000/auth/callback?code=code&error=access_denied"));
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("/login?error=sign_in_failed");
  });
  it("handles missing and failed code exchanges", async () => {
    expect((await GET(new Request("http://127.0.0.1:3000/auth/callback"))).headers.get("location")).toContain("sign_in_failed");
    mocks.exchange.mockResolvedValue({ error: new Error("private upstream error") });
    expect((await GET(new Request("http://127.0.0.1:3000/auth/callback?code=bad"))).headers.get("location")).toContain("sign_in_failed");
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("fails closed if the exchanged session has no verified user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await GET(new Request("http://127.0.0.1:3000/auth/callback?code=code"));
    expect(response.headers.get("location")).toContain("sign_in_failed");
  });
});
