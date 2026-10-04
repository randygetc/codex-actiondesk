import { z } from "zod";

export const projectFieldsSchema = z.object({
  name: z.string().trim().min(1, "Enter a project name.").max(120, "Use 120 characters or fewer."),
  description: z.string().max(2000, "Use 2,000 characters or fewer."),
}).strict();
export const projectIdSchema = z.uuid();
export const projectUpdateSchema = projectFieldsSchema.extend({ id: projectIdSchema });
export const projectArchiveSchema = z.object({ id: projectIdSchema, mode: z.enum(["archive", "restore"]) }).strict();
export const projectDeleteSchema = z.object({
  id: projectIdSchema, confirmed: z.literal("on", "Confirm permanent deletion first."),
}).strict();
