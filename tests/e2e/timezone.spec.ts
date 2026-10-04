import { expect, test } from "@playwright/test";
import { signInLocalFixture } from "./helpers/auth";

for (const scenario of [
  { name: "weekly November DST", anchor: "2026-10-25T09:00", frequency: "weekly", expected: "2026-11-01T17:00:00+00:00" },
  { name: "second Tuesday across year boundary", anchor: "2026-12-08T09:00", frequency: "monthly-weekday", expected: "2027-01-12T17:00:00+00:00" },
  { name: "spring nonexistent recurrence time", anchor: "2026-03-07T02:30", frequency: "daily", expected: "2026-03-08T10:30:00+00:00" },
]) {
  test(`${scenario.name} persists its captured schedule after profile timezone changes`, async ({ page, context }) => {
    const { supabase } = await signInLocalFixture(context);
    await page.goto("/tasks");
    await page.getByLabel("Task title", { exact: true }).fill(`Timezone fixture: ${scenario.name}`);
    await page.getByLabel("Due date/time", { exact: false }).fill(scenario.anchor);
    await page.getByLabel("Frequency", { exact: true }).selectOption(scenario.frequency);
    await page.getByLabel("Repeat ends", { exact: true }).selectOption("count");
    await page.getByRole("button", { name: "Create task" }).click();
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]+$/);
    const taskUrl = page.url();
    const id = new URL(taskUrl).pathname.split("/").at(-1)!;
    const original = await supabase.from("tasks").select("due_at,recurrence_anchor,recurrence_timezone").eq("id", id).single();
    expect(original.error).toBeNull();
    expect(original.data?.recurrence_timezone).toBe("America/Los_Angeles");
    await page.goto("/settings");
    await page.getByLabel("Timezone", { exact: true }).fill("Asia/Manila");
    await page.getByRole("button", { name: "Save timezone" }).click();
    await expect(page.getByRole("main").getByRole("status")).toBeVisible();
    await page.goto(taskUrl);
    await expect(page.getByLabel("Due date/time (Asia/Manila)", { exact: true })).toBeVisible();
    expect((await supabase.from("tasks").select("due_at,recurrence_anchor,recurrence_timezone").eq("id", id).single()).data).toEqual(original.data);
    await page.getByLabel("Status", { exact: true }).selectOption("done");
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText("Current status: done", { exact: true })).toBeVisible();
    const children = await supabase.from("tasks").select("*").eq("predecessor_id", id);
    expect(children.error).toBeNull();
    expect(children.data).toHaveLength(1);
    const child = children.data![0];
    expect(child.due_at).toBe(scenario.expected);
    expect(child.recurrence_timezone).toBe("America/Los_Angeles");
    expect(child.recurrence_anchor).toBe(original.data!.recurrence_anchor);
    expect(child.occurrence).toBe(2);
    await page.goto(`/tasks/${child.id}`);
    await page.getByLabel("Status", { exact: true }).selectOption("done");
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText("Current status: done", { exact: true })).toBeVisible();
    expect((await supabase.from("tasks").select("id").eq("predecessor_id", child.id)).data).toEqual([]);
    for (const taskId of [child.id, id]) {
      await page.goto(`/tasks/${taskId}`);
      await page.getByLabel("Confirm permanent task deletion").check();
      await page.getByRole("button", { name: "Delete task" }).click();
      await expect(page).toHaveURL(/\/tasks$/);
    }
  });
}
