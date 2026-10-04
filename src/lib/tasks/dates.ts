import { Temporal } from "@js-temporal/polyfill";
import { RRule } from "rrule";
export function localInput(instant: string | null, zone: string) {
    return instant ? Temporal.Instant.from(instant).toZonedDateTimeISO(zone).toPlainDateTime().toString({ smallestUnit: "minute" }) : "";
}
export function toInstant(local: string, zone: string, offset = "") {
    const wall = Temporal.PlainDateTime.from(local);
    // Parsing a bracketed zone with an explicit offset independently verifies that offset.
    if (offset)
        return Temporal.ZonedDateTime.from(`${wall}${offset}[${zone}]`, { offset: "reject" }).toInstant().toString();
    return wall.toZonedDateTime(zone, { disambiguation: "reject" }).toInstant().toString();
}
function floating(local: string) { return new Date(`${Temporal.PlainDateTime.from(local).toString()}Z`); }
function plain(date: Date) { return Temporal.PlainDateTime.from(date.toISOString().replace(/Z$/, "")); }
export function parseRule(text: string) {
    const value = text.trim().toUpperCase().replace(/^RRULE:/, "");
    if (!value || value.length > 300)
        throw new Error("Enter a supported recurrence rule.");
    const clauses = value.split(";");
    const keys = clauses.map(c => c.split("=")[0]);
    if (new Set(keys).size !== keys.length || keys.some(k => !["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "COUNT", "UNTIL"].includes(k)))
        throw new Error("Unsupported or duplicate recurrence clause.");
    const entries = Object.fromEntries(clauses.map(c => { if (!/^[A-Z]+=[A-Z0-9,+-]+$/.test(c))
        throw new Error("Invalid recurrence rule."); return c.split("="); }));
    if (!["DAILY", "WEEKLY", "MONTHLY"].includes(entries.FREQ) || (entries.COUNT && entries.UNTIL))
        throw new Error("Use daily, weekly or monthly, with COUNT or UNTIL.");
    for (const key of ["INTERVAL", "COUNT"])
        if (entries[key] && (!/^[1-9]\d*$/.test(entries[key]) || Number(entries[key]) > (key === "COUNT" ? 1000 : 365)))
            throw new Error("Recurrence interval/count is out of range.");
    if (entries.UNTIL && !/^\d{8}T\d{6}Z$/.test(entries.UNTIL))
        throw new Error("UNTIL must be a UTC timestamp.");
    if (entries.UNTIL) {
        const iso = entries.UNTIL.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z");
        try { Temporal.Instant.from(iso); } catch { throw new Error("UNTIL must be a valid UTC date/time."); }
    }
    if (entries.BYMONTHDAY && (!/^(?:[1-9]|[12]\d|3[01])$/.test(entries.BYMONTHDAY) || entries.FREQ !== "MONTHLY" || entries.BYDAY))
        throw new Error("Use one monthly day, from 1 to 31.");
    if (entries.BYDAY) {
        const pattern = entries.FREQ === "MONTHLY" ? /^(?:[1-4]|-1)(?:MO|TU|WE|TH|FR|SA|SU)$/ : /^(?:MO|TU|WE|TH|FR|SA|SU)(?:,(?:MO|TU|WE|TH|FR|SA|SU))*$/;
        if (entries.FREQ === "DAILY" || !pattern.test(entries.BYDAY))
            throw new Error("Invalid weekday recurrence.");
    }
    const options = RRule.parseString(value);
    return { value, options, until: options.until?.toISOString() ?? null, count: options.count ?? null };
}
export function validateAnchor(ruleText: string, anchor: string, zone: string, dueInstant?: string) {
    const { options, until } = parseRule(ruleText);
    const start = floating(anchor);
    const rule = new RRule({ ...options, dtstart: start, until: null, count: null });
    const first = rule.after(new Date(start.getTime() - 1), true);
    if (!first || first.getTime() !== start.getTime())
        throw new Error("First due date must match the recurrence rule.");
    if (until && Temporal.Instant.compare(dueInstant ?? toInstant(anchor, zone), until) > 0)
        throw new Error("First due date is after UNTIL.");
}
export function nextOccurrence(ruleText: string, anchor: string, zone: string, ordinal: number, currentDue?: string) {
    const { options, until, count } = parseRule(ruleText);
    if (count && ordinal >= count)
        return null;
    if (ordinal < 1 || (!currentDue && ordinal > 1000))
        throw new Error("Recurrence limit reached.");
    const rule = new RRule({ ...options, dtstart: floating(anchor), count: null, until: null });
    let cursor = floating(currentDue ? Temporal.Instant.from(currentDue).toZonedDateTimeISO(zone).toPlainDateTime().toString() : anchor);
    for (let i = 0; i < (currentDue ? 1 : ordinal); i++) {
        const date = rule.after(cursor, false);
        if (!date)
            return null;
        cursor = date;
    }
    const instant = plain(cursor).toZonedDateTime(zone, { disambiguation: "compatible" }).toInstant().toString();
    return until && Temporal.Instant.compare(instant, until) > 0 ? null : instant;
}
export function taskGroup(task: {
    status: string;
    due_at: string | null;
}, zone: string, now: string) {
    if (task.status === "done")
        return "Completed";
    if (!task.due_at)
        return "No due date";
    const current = Temporal.Instant.from(now).toZonedDateTimeISO(zone);
    const due = Temporal.Instant.from(task.due_at);
    if (Temporal.Instant.compare(due, current.toInstant()) < 0)
        return "Overdue";
    const tomorrow = current.toPlainDate().add({ days: 1 }).toZonedDateTime(zone);
    if (Temporal.Instant.compare(due, tomorrow.toInstant()) < 0)
        return "Today";
    const nextSunday = current.toPlainDate().add({ days: 7 - (current.dayOfWeek % 7) }).toZonedDateTime(zone);
    return Temporal.Instant.compare(due, nextSunday.toInstant()) < 0 ? "This week" : "Later";
}
export function displayDue(instant: string | null, zone: string) {
    return instant ? new Intl.DateTimeFormat("en-US", { timeZone: zone, dateStyle: "medium", timeStyle: "short" }).format(new Date(instant)) : "No due date";
}
