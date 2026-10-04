"use client";
import { useActionState } from "react";
import { updateTimezone, type TimezoneState } from "./actions";

const initialState: TimezoneState = { status: "idle", message: "" };
export function TimezoneForm({ timezone }: { timezone: string }) {
  const [state, action, pending] = useActionState(updateTimezone, initialState);
  return <form action={action} className="mt-8 max-w-md space-y-4">
    <label htmlFor="timezone" className="block font-medium">Timezone</label>
    <input id="timezone" name="timezone" defaultValue={timezone} required maxLength={100}
      list="timezones" aria-describedby="timezone-help" className="w-full rounded-lg border bg-background px-3 py-2" />
    <datalist id="timezones">{["America/Los_Angeles", "America/New_York", "Europe/London", "Asia/Manila", "UTC"].map(
      (zone) => <option key={zone} value={zone} />,
    )}</datalist>
    <p id="timezone-help" className="text-sm text-muted-foreground">Use an IANA timezone. This changes how dates are displayed; stored dates stay the same.</p>
    <button disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
      {pending ? "Saving…" : "Save timezone"}
    </button>
    {state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
  </form>;
}
