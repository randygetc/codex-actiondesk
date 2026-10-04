"use client";
import { useActionState, useId, useState } from "react";
import { saveTask, changeTaskStatus, deleteTask } from "./actions";
type Draft = { id: string; title: string; notes: string; priority: string; project_id: string | null; recurrence: string | null; status: string };
const inputClass = "mt-1 w-full rounded border bg-background px-3 py-2";
const weekdays = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function RecurrenceEditor({ initial = "", prefix }: { initial?: string; prefix: string }) {
  const clauses = Object.fromEntries(initial.split(";").map(part => part.split("=")));
  const [frequency, setFrequency] = useState(!initial ? "none" : clauses.FREQ === "MONTHLY" ? clauses.BYDAY ? "monthly-weekday" : "monthly-date" : clauses.FREQ.toLowerCase());
  const [interval, setInterval] = useState(clauses.INTERVAL ?? "1");
  const [days, setDays] = useState<string[]>(clauses.FREQ === "WEEKLY" ? (clauses.BYDAY ?? "").split(",").filter(Boolean) : []);
  const [monthDay, setMonthDay] = useState(clauses.BYMONTHDAY ?? "");
  const [ordinal, setOrdinal] = useState(clauses.FREQ === "MONTHLY" && clauses.BYDAY ? clauses.BYDAY.slice(0, -2) : "2");
  const [weekday, setWeekday] = useState(clauses.FREQ === "MONTHLY" && clauses.BYDAY ? clauses.BYDAY.slice(-2) : "TU");
  const [end, setEnd] = useState(clauses.COUNT ? "count" : clauses.UNTIL ? "until" : "never");
  const [count, setCount] = useState(clauses.COUNT ?? "2");
  const untilValue = clauses.UNTIL?.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6");
  const [until, setUntil] = useState(untilValue ?? "");
  let rule = "";
  if (frequency !== "none") {
    rule = `FREQ=${frequency.startsWith("monthly") ? "MONTHLY" : frequency.toUpperCase()};INTERVAL=${interval}`;
    if (frequency === "weekly" && days.length) rule += `;BYDAY=${weekdays.filter(d => days.includes(d)).join(",")}`;
    if (frequency === "monthly-date" && monthDay) rule += `;BYMONTHDAY=${monthDay}`;
    if (frequency === "monthly-weekday") rule += `;BYDAY=${ordinal}${weekday}`;
    if (end === "count") rule += `;COUNT=${count}`;
    if (end === "until") rule += `;UNTIL=${until.replace(/[-:]/g, "")}${until.length === 16 ? "00" : ""}Z`;
  }
  // Preserve the stored rule until the owner actually changes a recurrence control.
  const [changed, setChanged] = useState(false);
  return <fieldset className="space-y-3" onChange={() => setChanged(true)}>
    <legend className="font-medium">Repeat</legend>
    <input type="hidden" name="recurrence" value={changed ? rule : initial} />
    <label htmlFor={`${prefix}-frequency`}>Frequency</label>
    <select id={`${prefix}-frequency`} value={frequency} onChange={e => setFrequency(e.target.value)} className={inputClass}>
      <option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly-date">Monthly on a date</option><option value="monthly-weekday">Monthly on a weekday</option>
    </select>
    {frequency !== "none" && <>
      <label htmlFor={`${prefix}-interval`}>Repeat every</label><input id={`${prefix}-interval`} type="number" min={1} max={365} value={interval} onChange={e => setInterval(e.target.value)} className={inputClass} />
      {frequency === "weekly" && <div><p>Weekdays (leave empty to use the first due date)</p>{weekdays.map((day, index) => <label key={day} className="mr-3 inline-block"><input type="checkbox" checked={days.includes(day)} onChange={e => setDays(e.target.checked ? [...days, day] : days.filter(d => d !== day))} /> {weekdayNames[index]}</label>)}</div>}
      {frequency === "monthly-date" && <><label htmlFor={`${prefix}-monthday`}>Day of month (leave empty to use the first due date)</label><input id={`${prefix}-monthday`} type="number" min={1} max={31} value={monthDay} onChange={e => setMonthDay(e.target.value)} className={inputClass} /></>}
      {frequency === "monthly-weekday" && <>
        <label htmlFor={`${prefix}-ordinal`}>Which week</label><select id={`${prefix}-ordinal`} value={ordinal} onChange={e => setOrdinal(e.target.value)} className={inputClass}>{["1", "2", "3", "4", "-1"].map((v, index) => <option value={v} key={v}>{["First", "Second", "Third", "Fourth", "Last"][index]}</option>)}</select>
        <label htmlFor={`${prefix}-weekday`}>Weekday</label><select id={`${prefix}-weekday`} value={weekday} onChange={e => setWeekday(e.target.value)} className={inputClass}>{weekdays.map((d, index) => <option value={d} key={d}>{weekdayNames[index]}</option>)}</select>
      </>}
      <label htmlFor={`${prefix}-end`}>Repeat ends</label><select id={`${prefix}-end`} value={end} onChange={e => setEnd(e.target.value)} className={inputClass}><option value="never">Never</option><option value="count">After a number of occurrences</option><option value="until">At a UTC date/time</option></select>
      {end === "count" && <><label htmlFor={`${prefix}-count`}>Total occurrences (including this task)</label><input id={`${prefix}-count`} type="number" min={1} max={1000} value={count} onChange={e => setCount(e.target.value)} className={inputClass} /></>}
      {end === "until" && <><label htmlFor={`${prefix}-until`}>End at (UTC, inclusive)</label><input id={`${prefix}-until`} type="datetime-local" required value={until} onChange={e => setUntil(e.target.value)} className={inputClass} /></>}
      <p className="text-sm text-muted-foreground">The first due date must match. Invalid calendar dates are skipped. Completing creates the next scheduled task, including missed dates.</p>
    </>}
  </fieldset>;
}

export function TaskForm({ task, localDue = "", projects, timezone }: { task?: Draft; localDue?: string; projects: { id: string; name: string }[]; timezone: string }) {
  const prefix = useId();
  const [state, action, pending] = useActionState(saveTask, { message: "" });
  const [draft, setDraft] = useState({ title: task?.title ?? "", notes: task?.notes ?? "", priority: task?.priority ?? "normal", project_id: task?.project_id ?? "", due_local: localDue, offset: "" });
  function field(key: keyof typeof draft, label: string, type = "text") {
    return <div><label htmlFor={`${prefix}-${key}`}>{label}</label><input id={`${prefix}-${key}`} className={inputClass} name={key} type={type} value={draft[key]} required={key === "title"} maxLength={key === "title" ? 200 : undefined} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></div>;
  }
  return <form action={action} className="my-6 max-w-xl space-y-4">
    {task && <input type="hidden" name="id" value={task.id} />}
    {field("title", "Task title")}
    <div><label htmlFor={`${prefix}-notes`}>Notes</label><textarea id={`${prefix}-notes`} className={inputClass} name="notes" maxLength={10000} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></div>
    <div><label htmlFor={`${prefix}-priority`}>Priority</label><select id={`${prefix}-priority`} className={inputClass} name="priority" value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value })}>{["low", "normal", "high", "urgent"].map(p => <option key={p}>{p}</option>)}</select></div>
    <div><label htmlFor={`${prefix}-project`}>Project</label><select id={`${prefix}-project`} className={inputClass} name="project_id" value={draft.project_id} onChange={e => setDraft({ ...draft, project_id: e.target.value })}><option value="">No project</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
    {field("due_local", `Due date/time (${timezone})`, "datetime-local")}
    {field("offset", "UTC offset for ambiguous times (optional, e.g. -08:00)")}
    <RecurrenceEditor initial={task?.recurrence ?? ""} prefix={prefix} />
    {task && <label className="block"><input type="checkbox" name="reset_schedule" /> Start a new schedule when changing due date or recurrence</label>}
    <button disabled={pending} className="rounded bg-primary px-4 py-2 text-primary-foreground">{pending ? "Saving…" : task ? "Save task" : "Create task"}</button>
    {state.message && <p role={state.error ? "alert" : "status"}>{state.message}</p>}
  </form>;
}

export function TaskControls({ id, status }: { id: string; status: string }) {
  const prefix = useId();
  const [state, action, pending] = useActionState(changeTaskStatus, { message: "" });
  const [deletion, remove, deleting] = useActionState(deleteTask, { message: "" });
  const [confirmed, setConfirmed] = useState(false);
  return <div className="space-y-6">
    <form action={action} className="space-x-3"><input type="hidden" name="id" value={id} />
      <label htmlFor={`${prefix}-status`}>Status</label><select id={`${prefix}-status`} name="status" defaultValue={status} className="rounded border p-2">{["todo", "doing", "done"].map(s => <option key={s}>{s}</option>)}</select>
      <button disabled={pending} className="rounded border p-2">Save status</button>{state.message && <p role={state.error ? "alert" : "status"}>{state.message}</p>}
    </form>
    <form action={remove} className="space-y-3"><input type="hidden" name="id" value={id} />
      <label className="block"><input type="checkbox" name="confirmed" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> Confirm permanent task deletion</label>
      <button disabled={!confirmed || deleting} className="rounded border p-2">Delete task</button>{deletion.message && <p role="alert">{deletion.message}</p>}
    </form>
  </div>;
}
