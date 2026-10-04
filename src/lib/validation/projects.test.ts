import { describe, expect, it } from "vitest";
import { projectFieldsSchema, projectDeleteSchema, projectArchiveSchema } from "./projects";
const id = "21000000-0000-4000-8000-000000000001";
describe("project validation", () => {
  it("trims required names and retains descriptions as plain text", () => {
    expect(projectFieldsSchema.parse({ name: "  Launch  ", description: "<script>text</script>" }))
      .toEqual({ name: "Launch", description: "<script>text</script>" });
  });
  it.each(["", "   ", "x".repeat(121)])("rejects invalid name %s", (name) => {
    expect(projectFieldsSchema.safeParse({ name, description: "" }).success).toBe(false);
  });
  it("accepts bounds and rejects oversized descriptions and forged schema fields", () => {
    expect(projectFieldsSchema.safeParse({ name: "x".repeat(120), description: "x".repeat(2000) }).success).toBe(true);
    expect(projectFieldsSchema.safeParse({ name: "Launch", description: "x".repeat(2001) }).success).toBe(false);
    expect(projectFieldsSchema.safeParse({ name: "Launch", description: "", user_id: id }).success).toBe(false);
  });
  it("requires explicit delete confirmation and valid IDs", () => {
    expect(projectDeleteSchema.safeParse({ id, confirmed: "on" }).success).toBe(true);
    expect(projectDeleteSchema.safeParse({ id, confirmed: null }).success).toBe(false);
    expect(projectDeleteSchema.safeParse({ id: "invalid", confirmed: "on" }).success).toBe(false);
  });
  it("accepts only archive or restore operations", () => {
    expect(projectArchiveSchema.safeParse({ id, mode: "restore" }).success).toBe(true);
    expect(projectArchiveSchema.safeParse({ id, mode: "delete" }).success).toBe(false);
  });
});
