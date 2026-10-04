import { describe, expect, it } from "vitest";
import { localInput, nextOccurrence, taskGroup, toInstant, validateAnchor } from "./dates";

const pacific = "America/Los_Angeles";
describe("timezone edge-case checkpoint", () => {
  it("round-trips Pacific 23:30 on the same local day despite its next-day UTC date", () => {
    const due = toInstant("2026-10-04T23:30", pacific);
    expect(due).toBe("2026-10-05T06:30:00Z");
    expect(localInput(due, pacific)).toBe("2026-10-04T23:30");
    expect(taskGroup({ status: "todo", due_at: due }, pacific, "2026-10-04T19:00:00Z")).toBe("Today");
  });
  it("changes grouping in Manila while leaving the due instant intact", () => {
    const task = Object.freeze({ status: "todo", due_at: "2026-10-05T06:30:00Z" });
    const now = "2026-10-04T12:00:00Z";
    expect(taskGroup(task, pacific, now)).toBe("Today");
    expect(taskGroup(task, "Asia/Manila", now)).toBe("This week");
    expect(task.due_at).toBe("2026-10-05T06:30:00Z");
  });
  it("preserves weekly 09:00 across multiple persisted November occurrences", () => {
    const anchor = "2026-10-25T09:00";
    let due = "2026-10-25T16:00:00Z";
    for (const [ordinal, expected] of [[1, "2026-11-01T17:00:00Z"], [2, "2026-11-08T17:00:00Z"], [3, "2026-11-15T17:00:00Z"]] as const) {
      due = nextOccurrence("FREQ=WEEKLY", anchor, pacific, ordinal, due)!;
      expect(due).toBe(expected);
      expect(localInput(due, pacific).slice(-5)).toBe("09:00");
    }
  });
  it("preserves interval phase across DST", () => {
    expect(nextOccurrence("FREQ=WEEKLY;INTERVAL=2", "2026-10-25T09:00", pacific, 1, "2026-10-25T16:00:00Z")).toBe("2026-11-08T17:00:00Z");
  });
  it("advances second Tuesday across December and January", () => {
    const next = nextOccurrence("FREQ=MONTHLY;BYDAY=2TU", "2026-12-08T09:00", pacific, 1, "2026-12-08T17:00:00Z");
    expect(next).toBe("2027-01-12T17:00:00Z");
    expect(localInput(next, pacific)).toBe("2027-01-12T09:00");
  });
  it("skips non-leap February while retaining the original calendar anchor", () => {
    expect(nextOccurrence("FREQ=MONTHLY;INTERVAL=12;BYMONTHDAY=29", "2024-02-29T09:00", "UTC", 1, "2024-02-29T09:00:00Z")).toBe("2028-02-29T09:00:00Z");
  });
  it("does not drift day 31 after a skipped month", () => {
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=31", "2026-01-31T09:00", "UTC", 2, "2026-03-31T09:00:00Z")).toBe("2026-05-31T09:00:00Z");
  });
  it("validates both explicit overlap offsets and rejects an unrelated offset", () => {
    expect(toInstant("2026-11-01T01:30", pacific, "-07:00")).toBe("2026-11-01T08:30:00Z");
    expect(toInstant("2026-11-01T01:30", pacific, "-08:00")).toBe("2026-11-01T09:30:00Z");
    expect(() => toInstant("2026-11-01T01:30", pacific, "-06:00")).toThrow();
    expect(() => toInstant("2026-03-08T02:30", pacific, "-08:00")).toThrow();
    expect(() => validateAnchor("FREQ=DAILY;UNTIL=20261102T090000Z", "2026-11-01T01:30", pacific, "2026-11-01T09:30:00Z")).not.toThrow();
  });
  it("compares overdue overlap times by instant rather than repeated wall clock", () => {
    expect(taskGroup({ status: "todo", due_at: "2026-11-01T08:45:00Z" }, pacific, "2026-11-01T09:15:00Z")).toBe("Overdue");
    expect(taskGroup({ status: "todo", due_at: "2026-11-01T09:45:00Z" }, pacific, "2026-11-01T09:15:00Z")).toBe("Today");
  });
  it("uses local midnight on the 23-hour spring and 25-hour autumn days", () => {
    for (const [now, beforeMidnight, midnight] of [
      ["2026-03-08T09:00:00Z", "2026-03-09T06:59:59Z", "2026-03-09T07:00:00Z"],
      ["2026-11-01T08:00:00Z", "2026-11-02T07:59:59Z", "2026-11-02T08:00:00Z"],
    ]) {
      expect(taskGroup({ status: "todo", due_at: beforeMidnight }, pacific, now)).toBe("Today");
      expect(taskGroup({ status: "todo", due_at: midnight }, pacific, now)).toBe("This week");
    }
  });
  it("uses Sunday midnight's actual offset when DST changes during the week", () => {
    expect(taskGroup({ status: "todo", due_at: "2026-03-15T06:59:59Z" }, pacific, "2026-03-08T09:00:00Z")).toBe("This week");
    expect(taskGroup({ status: "todo", due_at: "2026-03-15T07:00:00Z" }, pacific, "2026-03-08T09:00:00Z")).toBe("Later");
    expect(taskGroup({ status: "todo", due_at: "2026-11-08T08:00:00Z" }, pacific, "2026-11-01T08:00:00Z")).toBe("Later");
  });
  it("classifies exact now as Today and keeps undated completed tasks Completed", () => {
    const now = "2026-10-04T19:00:00Z";
    expect(taskGroup({ status: "todo", due_at: now }, pacific, now)).toBe("Today");
    expect(taskGroup({ status: "done", due_at: null }, pacific, now)).toBe("Completed");
  });
  it("exhausts count across skipped months and compares UTC UNTIL after DST conversion", () => {
    expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=31;COUNT=2", "2026-01-31T09:00", "UTC", 2, "2026-03-31T09:00:00Z")).toBeNull();
    expect(nextOccurrence("FREQ=WEEKLY;UNTIL=20261101T170000Z", "2026-10-25T09:00", pacific, 1, "2026-10-25T16:00:00Z")).toBe("2026-11-01T17:00:00Z");
    expect(nextOccurrence("FREQ=WEEKLY;UNTIL=20261101T165959Z", "2026-10-25T09:00", pacific, 1, "2026-10-25T16:00:00Z")).toBeNull();
  });
});
