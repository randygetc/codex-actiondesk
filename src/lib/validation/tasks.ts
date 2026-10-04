import { z } from "zod";
export const taskFieldsSchema = z.object({
    title: z.string().trim().min(1, "Enter a task title.").max(200),
    notes: z.string().max(10000), priority: z.enum(["low", "normal", "high", "urgent"]),
    project_id: z.union([z.uuid(), z.literal("")]).transform(v => v || null),
    due_local: z.string().max(30), offset: z.string().regex(/^(?:[+-]\d{2}:\d{2})?$/, "Use an offset such as -08:00."),
    recurrence: z.string().trim().max(300), reset_schedule: z.boolean(),
}).strict();
export const taskIdSchema = z.uuid();
export const taskStatusSchema = z.object({ id: z.uuid(), status: z.enum(["todo", "doing", "done"]) }).strict();
export const taskDeleteSchema = z.object({ id: z.uuid(), confirmed: z.literal("on") }).strict();
