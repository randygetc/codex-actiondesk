import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseConfig } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("public Supabase configuration", () => {
  it("returns only public settings", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "private-admin-test-key");
    vi.stubEnv("OPENAI_API_KEY", "private-openai-test-key");
    expect(getSupabaseConfig()).toEqual({ url: "http://127.0.0.1:54321", publishableKey: "public-test-key" });
  });

  it.each([undefined, "", "not-a-url"])("rejects invalid URL %s", (url) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
    expect(getSupabaseConfig).toThrow("Set NEXT_PUBLIC_SUPABASE_URL");
  });

  it("rejects missing public key without including private values in errors", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "private-test-key");
    expect(getSupabaseConfig).toThrow("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  });
});
