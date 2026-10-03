import { z } from "zod";
import { logContextSchema, logEventSchema } from "@/lib/validation/log";

type LogContext = z.input<typeof logContextSchema>;
type LogEvent = z.input<typeof logEventSchema>;

export function logEvent(event: LogEvent, context: LogContext = {}) {
  // Parse an allowlist, stripping unexpected fields instead of serializing raw errors/content.
  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: logEventSchema.parse(event),
    ...logContextSchema.parse(context),
  }));
}
