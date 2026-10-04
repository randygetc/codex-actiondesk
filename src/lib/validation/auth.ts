import { z } from "zod";

export const destinationSchema = z.enum(["/tasks", "/projects", "/settings"]);
export function safeDestination(value: unknown) {
  const parsed = destinationSchema.safeParse(value);
  return parsed.success ? parsed.data : "/tasks";
}
export const oauthInputSchema = z.object({ next: destinationSchema });
export const signOutInputSchema = z.object({}).strict();
export const authCodeSchema = z.string().min(1).max(4096);
export const timezoneSchema = z.string().min(1).max(100).refine((value) => {
  if (value !== "UTC" && !/^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch { return false; }
}, "Enter a valid IANA timezone, such as America/Los_Angeles.");
export const profileTimezoneSchema = z.object({ timezone: timezoneSchema }).strict();
export const appOriginSchema = z.url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
    && url.pathname === "/" && !url.search && !url.hash;
}, "APP_URL must be an HTTP(S) origin without a path.");
