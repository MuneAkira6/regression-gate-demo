// The /api/tasks endpoint group. Playwright's `request` fixture talks to the app directly, with no
// browser in the way, so a failure here is about the API and not about a page.

import { expect, test } from "@playwright/test";

type Task = { id: number; title: string; status: string; due: string | null };

const SEEDED_TITLES = [
  "Draft the release notes",
  "Review the onboarding copy",
  "Archive the old reports",
  "Plan the next retrospective",
  "Tidy the shared inbox",
];

/** A task of this test's own, so the cases that change data leave the seeded five alone. */
async function createOwnTask(
  request: import("@playwright/test").APIRequestContext,
  title: string,
): Promise<Task> {
  const response = await request.post("/api/tasks", { data: { title } });
  expect(response.status()).toBe(201);
  return (await response.json()) as Task;
}

test("TB-012 returns every task as JSON", async ({ request }) => {
  const response = await request.get("/api/tasks");
  expect(response.status()).toBe(200);
  const tasks = (await response.json()) as Task[];
  const titles = tasks.map((task) => task.title);
  for (const title of SEEDED_TITLES) expect(titles).toContain(title);
  expect(tasks.filter((task) => task.due === null).length).toBeGreaterThanOrEqual(2);
});

test("TB-013 filters the task API by status", async ({ request }) => {
  const open = (await (await request.get("/api/tasks?status=open")).json()) as Task[];
  expect(open.length).toBeGreaterThan(0);
  expect(open.filter((task) => task.status !== "open")).toEqual([]);

  const done = (await (await request.get("/api/tasks?status=done")).json()) as Task[];
  expect(done.length).toBeGreaterThan(0);
  expect(done.filter((task) => task.status !== "done")).toEqual([]);
});

test("TB-014 sorts the task API by due date with undated tasks last", async ({ request }) => {
  const tasks = (await (await request.get("/api/tasks?sort=due")).json()) as Task[];
  const firstUndated = tasks.findIndex((task) => task.due === null);
  expect(firstUndated, "the seed has undated tasks, so this check is not vacuous").toBeGreaterThan(
    -1,
  );
  // Nothing dated may appear at or after the first undated task.
  expect(tasks.slice(firstUndated).filter((task) => task.due !== null)).toEqual([]);

  const dated = tasks.slice(0, firstUndated).map((task) => task.due);
  expect(dated.length).toBeGreaterThan(0);
  expect(dated).toEqual([...dated].sort());
});

test("TB-015 returns one task from the task API", async ({ request }) => {
  const response = await request.get("/api/tasks/1");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    id: 1,
    title: "Draft the release notes",
    status: "open",
    due: "2026-10-02",
  });
});

test("TB-016 answers an unknown id with a 404 JSON error", async ({ request }) => {
  const response = await request.get("/api/tasks/999");
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({ error: "not found" });
});

test("TB-017 creates a task", async ({ request }) => {
  const created = await createOwnTask(request, "TB-017 a task created by the suite");
  expect(created.title).toBe("TB-017 a task created by the suite");
  expect(created.status).toBe("open");
  expect(typeof created.id).toBe("number");

  const all = (await (await request.get("/api/tasks")).json()) as Task[];
  expect(all.map((task) => task.id)).toContain(created.id);
});

test("TB-018 requires a title when creating a task", async ({ request }) => {
  const missing = await request.post("/api/tasks", { data: {} });
  expect(missing.status()).toBe(400);
  expect(await missing.json()).toEqual({ error: "title is required" });

  const empty = await request.post("/api/tasks", { data: { title: "   " } });
  expect(empty.status()).toBe(400);
  expect(await empty.json()).toEqual({ error: "title is required" });
});

test("TB-019 changes a task's status", async ({ request }) => {
  const task = await createOwnTask(request, "TB-019 a task whose status moves");

  const toDone = await request.patch(`/api/tasks/${task.id}`, { data: { status: "done" } });
  expect(toDone.status()).toBe(200);
  expect(((await toDone.json()) as Task).status).toBe("done");

  const toOpen = await request.patch(`/api/tasks/${task.id}`, { data: { status: "open" } });
  expect(toOpen.status()).toBe(200);
  expect(((await toOpen.json()) as Task).status).toBe("open");
});

test("TB-020 rejects a status that is neither open nor done", async ({ request }) => {
  const task = await createOwnTask(request, "TB-020 a task whose status must not move");

  const response = await request.patch(`/api/tasks/${task.id}`, { data: { status: "archived" } });
  expect(response.status()).toBe(400);

  const after = (await (await request.get(`/api/tasks/${task.id}`)).json()) as Task;
  expect(after.status, "a rejected status must leave the task as it was").toBe("open");
});
