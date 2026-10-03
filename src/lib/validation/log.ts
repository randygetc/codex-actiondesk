import { z } from "zod";

export const logEventSchema = z.enum(["auth.refresh_failed", "request.completed", "llm.completed"]);
export const logContextSchema = z.object({
  requestId: z.uuid().optional(),
  userId: z.uuid().optional(),
  workspaceId: z.uuid().optional(),
  feature: z.enum(["auth", "tasks", "extraction", "ask", "digest"]).optional(),
  latencyMs: z.number().finite().nonnegative().optional(),
  outcome: z.enum(["success", "failure", "cancelled"]).optional(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  cachedTokens: z.number().int().nonnegative().optional(),
});
