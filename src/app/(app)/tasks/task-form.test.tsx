import { fireEvent,render,screen } from "@testing-library/react";
import { describe,expect,it,vi } from "vitest";
import { TaskForm } from "./task-form";
vi.mock("./actions",()=>({saveTask:vi.fn(),changeTaskStatus:vi.fn(),deleteTask:vi.fn()}));
function rule(container:HTMLElement){return container.querySelector<HTMLInputElement>('input[name="recurrence"]')!.value;}
describe("recurrence editor",()=>{
 it("builds weekly selection and finite counts",()=>{
  const {container}=render(<TaskForm projects={[]} timezone="UTC"/>);
  fireEvent.change(screen.getByLabelText("Frequency"),{target:{value:"weekly"}});
  fireEvent.click(screen.getByLabelText("Tuesday"));
  fireEvent.change(screen.getByLabelText("Repeat ends"),{target:{value:"count"}});
  fireEvent.change(screen.getByLabelText("Total occurrences (including this task)"),{target:{value:"5"}});
  expect(rule(container)).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;COUNT=5");
 });
 it("supports monthly ordinal weekdays",()=>{
  const {container}=render(<TaskForm projects={[]} timezone="UTC"/>);
  fireEvent.change(screen.getByLabelText("Frequency"),{target:{value:"monthly-weekday"}});
  expect(rule(container)).toBe("FREQ=MONTHLY;INTERVAL=1;BYDAY=2TU");
 });
 it("preserves existing rule when only content changes",()=>{
  const {container}=render(<TaskForm timezone="UTC" projects={[]} task={{id:"task",title:"Task",notes:"",priority:"normal",project_id:null,recurrence:"FREQ=WEEKLY;COUNT=2",status:"todo"}}/>);
  fireEvent.change(screen.getByLabelText("Task title"),{target:{value:"Edited"}});
  expect(rule(container)).toBe("FREQ=WEEKLY;COUNT=2");
 });
 it("encodes an inclusive UTC ending",()=>{
  const {container}=render(<TaskForm projects={[]} timezone="UTC"/>);
  fireEvent.change(screen.getByLabelText("Frequency"),{target:{value:"daily"}});
  fireEvent.change(screen.getByLabelText("Repeat ends"),{target:{value:"until"}});
  fireEvent.change(screen.getByLabelText("End at (UTC, inclusive)"),{target:{value:"2026-10-10T09:00"}});
  expect(rule(container)).toBe("FREQ=DAILY;INTERVAL=1;UNTIL=20261010T090000Z");
 });
});
