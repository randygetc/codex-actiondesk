// @vitest-environment node
import type { CookieMethodsServer } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { updateSession } from "./proxy";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), getUser: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
});
afterEach(() => vi.unstubAllEnvs());

it("uses the public client and verifies identity with getUser", async () => {
  await updateSession(new NextRequest("http://localhost/tasks"));
  expect(mocks.createServerClient).toHaveBeenCalledWith(
    "http://127.0.0.1:54321", "public-test-key", expect.any(Object),
  );
  expect(mocks.getUser).toHaveBeenCalledOnce();
});

it("propagates refreshed cookies to request and response and preserves cache headers", async () => {
  const request = new NextRequest("http://localhost/tasks");
  mocks.createServerClient.mockImplementation((_url, _key, options: { cookies: CookieMethodsServer }) => {
    mocks.getUser.mockImplementation(async () => {
      options.cookies.setAll?.([{ name: "auth-test", value: "refreshed", options: { path: "/", httpOnly: true } }], {
        "cache-control": "private, no-store", pragma: "no-cache", expires: "0",
      });
      // @supabase/ssr only supplies cache headers on the first write.
      options.cookies.setAll?.([{ name: "auth-verifier", value: "", options: { maxAge: 0 } }], {});
      return { data: { user: null }, error: null };
    });
    return { auth: { getUser: mocks.getUser } };
  });
  const response = await updateSession(request);
  expect(request.cookies.get("auth-test")?.value).toBe("refreshed");
  expect(response.cookies.get("auth-test")?.value).toBe("refreshed");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("pragma")).toBe("no-cache");
});

it("does not log expected missing-session errors", async () => {
  const output = vi.spyOn(console, "info").mockImplementation(() => {});
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError" } });
  await updateSession(new NextRequest("http://localhost/tasks"));
  expect(output).not.toHaveBeenCalled();
});

it("redacts refresh failures", async () => {
  const output = vi.spyOn(console, "info").mockImplementation(() => {});
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthApiError", message: "private-token" } });
  await updateSession(new NextRequest("http://localhost/tasks"));
  expect(output).toHaveBeenCalledOnce();
  expect(output.mock.calls[0][0]).not.toContain("private-token");
});
