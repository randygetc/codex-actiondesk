import { expect, it, vi } from "vitest";
import { logEvent } from "./logger";

it("logs approved metadata and strips accidental content/secrets", () => {
  const output = vi.spyOn(console, "info").mockImplementation(() => {});
  const context = {
    feature: "auth" as const,
    outcome: "failure" as const,
    notes: "private meeting content",
    apiKey: "private-secret",
    rawError: { message: "private access token" },
  };
  logEvent("auth.refresh_failed", context);
  const record = JSON.parse(output.mock.calls[0][0] as string);
  expect(record).toEqual({
    timestamp: expect.any(String), event: "auth.refresh_failed", feature: "auth", outcome: "failure",
  });
  expect(output.mock.calls[0][0]).not.toContain("private");
});

it("rejects malformed metadata before logging", () => {
  const output = vi.spyOn(console, "info").mockImplementation(() => {});
  expect(() => logEvent("request.completed", { latencyMs: -1 })).toThrow();
  expect(output).not.toHaveBeenCalled();
});
