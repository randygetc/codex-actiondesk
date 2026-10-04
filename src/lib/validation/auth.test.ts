import { describe, expect, it } from "vitest";
import { appOriginSchema, safeDestination, timezoneSchema } from "./auth";

describe("auth input validation", () => {
  it.each(["America/Los_Angeles", "Asia/Manila", "Europe/London", "UTC"])("accepts %s", (zone) => {
    expect(timezoneSchema.safeParse(zone).success).toBe(true);
  });
  it.each(["PST", "GMT+8", "Invalid/Zone", "", " UTC ", "<script>", null])("rejects invalid timezone %s", (zone) => {
    expect(timezoneSchema.safeParse(zone).success).toBe(false);
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "%2f%2fevil.example",
    "/auth/callback", "/tasks/../login", "/settings?next=//evil.example", null])("rejects unsafe destination %s", (value) => {
    expect(safeDestination(value)).toBe("/tasks");
  });
  it("retains approved destinations", () => expect(safeDestination("/settings")).toBe("/settings"));
  it.each(["javascript:alert(1)", "https://user:secret@example.test", "https://example.test/path"])("rejects unsafe origin %s", (value) => {
    expect(appOriginSchema.safeParse(value).success).toBe(false);
  });
});
