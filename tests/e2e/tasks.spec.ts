import { expect, test } from "@playwright/test";
import { signInLocalFixture } from "./helpers/auth";
test("task editor retains drafts, saves dates, completes recurrence and protects project history", async ({ page, context, browser }) => {
    const owner = await signInLocalFixture(context);
    await page.goto("/projects");
    await page.getByLabel("Project name", { exact: true }).fill("Task project");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
    const projectUrl = page.url();
    await page.goto("/tasks");
    await page.getByLabel("Task title", { exact: true }).fill("   ");
    await page.getByLabel("Notes", { exact: true }).fill("<b>Keep draft</b>");
    await page.getByRole("button", { name: "Create task" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Enter a task title.");
    await expect(page.getByLabel("Notes", { exact: true })).toHaveValue("<b>Keep draft</b>");
    await page.getByLabel("Task title", { exact: true }).fill("Recurring task");
    await page.getByLabel("Project", { exact: true }).selectOption({ label: "Task project" });
    await page.getByLabel("Due date/time", { exact: false }).fill("2026-10-25T09:00");
    await page.getByLabel("Frequency", { exact: true }).selectOption("weekly");
    await page.getByLabel("Repeat ends", { exact: true }).selectOption("count");
    await page.getByRole("button", { name: "Create task" }).click();
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]+$/);
    const taskUrl = page.url();
    const id = new URL(taskUrl).pathname.split("/").at(-1)!;
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Recurring task");
    await expect(page.getByRole("main").locator("b")).toHaveCount(0);
    await page.getByLabel("Task title", { exact: true }).fill("Edited recurring task");
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Task saved.");
    await page.getByLabel("Status", { exact: true }).selectOption("done");
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText("Current status: done", { exact: true })).toBeVisible();
    const children = await owner.supabase.from("tasks").select("*").eq("predecessor_id", id);
    expect(children.error).toBeNull();
    expect(children.data).toHaveLength(1);
    expect(children.data![0].due_at).toBe("2026-11-01T17:00:00+00:00");
    expect(children.data![0].title).toBe("Edited recurring task");
    await page.getByLabel("Status", { exact: true }).selectOption("todo");
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText("Current status: todo", { exact: true })).toBeVisible();
    await page.getByLabel("Status", { exact: true }).selectOption("done");
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText("Current status: done", { exact: true })).toBeVisible();
    expect((await owner.supabase.from("tasks").select("id").eq("predecessor_id", id)).data).toHaveLength(1);
    await page.goto(projectUrl);
    await page.getByLabel("Confirm permanent deletion", { exact: true }).check();
    await page.getByRole("button", { name: "Delete project" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("This project is still referenced. Archive it instead.");
    await page.getByRole("button", { name: "Archive project", exact: true }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await page.goto("/tasks");
    await expect(page.getByLabel("Project", { exact: true }).locator("option")).toHaveCount(1);
    await page.goto(`/tasks/${children.data![0].id}`);
    await page.getByLabel("Status", { exact: true }).selectOption("done");
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText("Current status: done", { exact: true })).toBeVisible();
    expect((await owner.supabase.from("tasks").select("id").eq("predecessor_id", children.data![0].id)).data).toHaveLength(0);
    const otherContext = await browser.newContext();
    try {
        const other = await signInLocalFixture(otherContext);
        const otherPage = await otherContext.newPage();
        await otherPage.goto(taskUrl);
        await expect(otherPage.getByText("This page could not be found.")).toBeVisible();
        expect((await other.supabase.from("tasks").select("id").eq("id", id)).data).toEqual([]);
        expect((await other.supabase.from("tasks").update({ title: "Foreign" }).eq("id", id).select("id")).data).toEqual([]);
        expect((await other.supabase.from("tasks").delete().eq("id", id).select("id")).data).toEqual([]);
        expect((await other.supabase.rpc("complete_task", { p_id: id, p_revision: 1, p_next: null as unknown as string })).error?.code).toBe("42501");
        expect((await other.supabase.from("tasks").insert({ user_id: owner.user.id, title: "Forged" })).error?.code).toBe("42501");
    }
    finally {
        await otherContext.close();
    }
    // Delete disposable leaves first; the restrictive predecessor FK keeps history intact otherwise.
    for (const taskId of [children.data![0].id, id]) {
        await page.goto(`/tasks/${taskId}`);
        await page.getByLabel("Confirm permanent task deletion").check();
        await page.getByRole("button", { name: "Delete task" }).click();
        await expect(page).toHaveURL(/\/tasks$/);
    }
    await page.goto(projectUrl);
    await page.getByLabel("Confirm permanent deletion", { exact: true }).check();
    await page.getByRole("button", { name: "Delete project" }).click();
    await expect(page).toHaveURL(/\/projects$/);
});
test("concurrent completion is atomic and idempotent", async ({ context }) => {
    const { supabase } = await signInLocalFixture(context);
    const { data: t, error } = await supabase.from("tasks").insert({ title: "Concurrent fixture", due_at: "2026-10-01T09:00:00Z", recurrence: "FREQ=DAILY;COUNT=2", recurrence_timezone: "UTC", recurrence_anchor: "2026-10-01T09:00:00" }).select("*").single();
    expect(error).toBeNull();
    const results = await Promise.all(Array.from({ length: 8 }, () => supabase.rpc("complete_task", { p_id: t!.id, p_revision: 1, p_next: "2026-10-02T09:00:00Z" })));
    for (const result of results)
        expect(result.error).toBeNull();
    const children = await supabase.from("tasks").select("id").eq("predecessor_id", t!.id);
    expect(children.data).toHaveLength(1);
    expect(new Set(results.map(r => r.data)).size).toBe(1);
    for (const id of [children.data![0].id, t!.id])
        expect((await supabase.from("tasks").delete().eq("id", id)).error).toBeNull();
});

test("one-off task edits round-trip through a changed display timezone", async ({page,context})=>{
 const {supabase}=await signInLocalFixture(context);
 await page.goto("/tasks");await page.getByLabel("Task title",{exact:true}).fill("One-off task");await page.getByLabel("Priority",{exact:true}).selectOption("high");await page.getByRole("button",{name:"Create task"}).click();await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]+$/);
 const taskUrl=page.url();const id=new URL(taskUrl).pathname.split("/").at(-1)!;
 await page.getByLabel("Due date/time",{exact:false}).fill("2027-01-01T09:00");await page.getByLabel("Start a new schedule",{exact:false}).check();await page.getByRole("button",{name:"Save task",exact:true}).click();await expect(page.getByRole("main").getByRole("status")).toHaveText("Task saved.");
 const before=await supabase.from("tasks").select("due_at").eq("id",id).single();expect(before.data?.due_at).toBe("2027-01-01T17:00:00+00:00");
 await page.goto("/settings");await page.getByLabel("Timezone",{exact:true}).fill("Asia/Manila");await page.getByRole("button",{name:"Save timezone"}).click();await expect(page.getByRole("main").getByRole("status")).toBeVisible();
 await page.goto(taskUrl);await expect(page.getByLabel("Due date/time (Asia/Manila)",{exact:true})).toHaveValue("2027-01-02T01:00");
 await page.getByLabel("Task title",{exact:true}).fill("Edited one-off");await page.getByRole("button",{name:"Save task",exact:true}).click();await expect(page.getByRole("main").getByRole("status")).toHaveText("Task saved.");expect((await supabase.from("tasks").select("due_at").eq("id",id).single()).data?.due_at).toBe(before.data?.due_at);
 await page.getByLabel("Status",{exact:true}).selectOption("doing");await page.getByRole("button",{name:"Save status"}).click();await expect(page.getByText("Current status: doing",{exact:true})).toBeVisible();
 await page.getByLabel("Status",{exact:true}).selectOption("done");await page.getByRole("button",{name:"Save status"}).click();await expect(page.getByText("Current status: done",{exact:true})).toBeVisible();expect((await supabase.from("tasks").select("id").eq("predecessor_id",id)).data).toHaveLength(0);
 await expect(page.getByRole("button",{name:"Delete task"})).toBeDisabled();await page.getByLabel("Confirm permanent task deletion").check();await page.getByRole("button",{name:"Delete task"}).click();await expect(page).toHaveURL(/\/tasks$/);
});
