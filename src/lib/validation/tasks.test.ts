import { describe,expect,it } from "vitest";
import { taskFieldsSchema,taskStatusSchema,taskDeleteSchema } from "./tasks";
const base={title:"Task",notes:"",priority:"normal",project_id:"",due_local:"",offset:"",recurrence:"",reset_schedule:false};
describe("task inputs",()=>{
 it("trims titles and normalizes no project",()=>{const parsed=taskFieldsSchema.parse({...base,title:"  Task  "});expect(parsed.title).toBe("Task");expect(parsed.project_id).toBeNull();});
 it.each([{title:"x".repeat(201)},{notes:"x".repeat(10001)},{priority:"critical"},{project_id:"bad-id"},{offset:"PST"},{owner:"forged"}])("rejects invalid bounds and unknown fields",change=>{expect(taskFieldsSchema.safeParse({...base,...change}).success).toBe(false);});
 it("rejects unknown statuses and missing deletion confirmation",()=>{const id="32000000-0000-4000-8000-000000000001";expect(taskStatusSchema.safeParse({id,status:"cancelled"}).success).toBe(false);expect(taskDeleteSchema.safeParse({id}).success).toBe(false);});
});
