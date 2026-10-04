import { describe, expect, it } from "vitest";
import { nextOccurrence, parseRule, taskGroup, toInstant, validateAnchor } from "./dates";
describe("task calendars", () => {
    it("advances precisely when a persisted due date includes seconds", () => {
      expect(nextOccurrence("FREQ=DAILY", "2026-10-01T09:00:30", "UTC", 1, "2026-10-01T09:00:30Z")).toBe("2026-10-02T09:00:30Z");
    });
    it("uses original schedule time after a shifted spring occurrence", () => {
      expect(nextOccurrence("FREQ=DAILY", "2026-03-07T02:30", "America/Los_Angeles", 2, "2026-03-08T10:30:00Z")).toBe("2026-03-09T09:30:00Z");
    });
    it("rejects calendar-invalid UTC endings", () => {
      expect(() => parseRule("FREQ=DAILY;UNTIL=20260230T090000Z")).toThrow();
    });
    it("keeps late Pacific dates Today and regroups in Manila", () => {
        const task = { status: "todo", due_at: "2026-10-04T06:30:00Z" };
        expect(taskGroup(task, "America/Los_Angeles", "2026-10-03T12:00:00Z")).toBe("Today");
        expect(taskGroup(task, "Asia/Manila", "2026-10-03T12:00:00Z")).toBe("Later");
    });
    it("preserves weekly wall time across November DST", () => expect(nextOccurrence("FREQ=WEEKLY", "2026-10-25T09:00", "America/Los_Angeles", 1)).toBe("2026-11-01T17:00:00Z"));
    it("advances second Tuesday", () => expect(nextOccurrence("FREQ=MONTHLY;BYDAY=2TU", "2026-10-13T09:00", "UTC", 1)).toBe("2026-11-10T09:00:00Z"));
    it("skips invalid month days", () => expect(nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=31", "2026-01-31T09:00", "UTC", 1)).toBe("2026-03-31T09:00:00Z"));
    it("rejects manual gaps and ambiguous overlap without offset", () => {
        expect(() => toInstant("2026-03-08T02:30", "America/Los_Angeles")).toThrow();
        expect(() => toInstant("2026-11-01T01:30", "America/Los_Angeles")).toThrow();
        expect(toInstant("2026-11-01T01:30", "America/Los_Angeles", "-08:00")).toBe("2026-11-01T09:30:00Z");
    });
    it("shifts recurrence gaps and chooses earlier overlap", () => {
        expect(nextOccurrence("FREQ=DAILY", "2026-03-07T02:30", "America/Los_Angeles", 1)).toBe("2026-03-08T10:30:00Z");
        expect(nextOccurrence("FREQ=DAILY", "2026-10-31T01:30", "America/Los_Angeles", 1)).toBe("2026-11-01T08:30:00Z");
    });
    it("exhausts COUNT and inclusive UNTIL", () => {
        expect(nextOccurrence("FREQ=DAILY;COUNT=2", "2026-01-01T09:00", "UTC", 2)).toBeNull();
        expect(nextOccurrence("FREQ=DAILY;UNTIL=20260102T090000Z", "2026-01-01T09:00", "UTC", 1)).toBe("2026-01-02T09:00:00Z");
        expect(nextOccurrence("FREQ=DAILY;UNTIL=20260102T090000Z", "2026-01-01T09:00", "UTC", 2)).toBeNull();
    });
    it("rejects unsupported rules and mismatched anchors", () => {
        for (const value of ["FREQ=HOURLY", "FREQ=DAILY;COUNT=0", "FREQ=DAILY;FREQ=WEEKLY", "FREQ=DAILY;BYSECOND=2", "FREQ=MONTHLY;BYDAY=8TU"])
            expect(() => parseRule(value)).toThrow();
        expect(() => validateAnchor("FREQ=WEEKLY;BYDAY=TU", "2026-10-12T09:00", "UTC")).toThrow();
    });
    it("includes October 8 in the week beginning Sunday October 4", () => {
        expect(taskGroup({ status: "todo", due_at: "2026-10-08T16:00:00Z" }, "America/Los_Angeles", "2026-10-04T19:00:00Z")).toBe("This week");
    });
    it("includes Saturday and excludes Sunday at local midnight", () => {
        const zone = "America/Los_Angeles";
        const now = "2026-10-09T19:00:00Z";
        expect(taskGroup({ status: "todo", due_at: "2026-10-11T06:59:59Z" }, zone, now)).toBe("This week");
        expect(taskGroup({ status: "todo", due_at: "2026-10-11T07:00:00Z" }, zone, now)).toBe("Later");
    });
    it("uses exclusive midnight and Sunday boundaries", () => {
        const now = "2026-10-04T12:00:00Z";
        expect(taskGroup({ status: "todo", due_at: "2026-10-11T00:00:00Z" }, "UTC", now)).toBe("Later");
        expect(taskGroup({ status: "todo", due_at: "2026-10-04T11:00:00Z" }, "UTC", now)).toBe("Overdue");
        expect(taskGroup({ status: "todo", due_at: null }, "UTC", now)).toBe("No due date");
        expect(taskGroup({ status: "done", due_at: now }, "UTC", now)).toBe("Completed");
    });
});
