// The task list and detail pages.
//
// Nothing here asserts "exactly five rows". The contract has no delete, so TB-017, TB-019 and TB-020
// add tasks that stay for the life of the process, and tests/api sorts before tests/ui — so an
// absolute count would go red on the second of two consecutive runs and under the gate, which runs
// every unit against one long-lived app. The contract's actual rules are relational (these tasks
// exist; undated tasks come last), so that is what is asserted.

import { expect, test } from "@playwright/test";

const SEEDED_OPEN = [
  "Draft the release notes",
  "Review the onboarding copy",
  "Plan the next retrospective",
  "Tidy the shared inbox",
];
const SEEDED_DONE = "Archive the old reports";
const NO_DUE = "no due date";

test("TB-004 lists every task with its due date", async ({ page }) => {
  await page.goto("/tasks");
  const titles = await page.getByTestId("task-title").allTextContents();
  for (const title of [...SEEDED_OPEN, SEEDED_DONE]) {
    expect(titles, `the seeded task "${title}" must be listed`).toContain(title);
  }
  // Two of the five seeded tasks have no due date and must say so rather than show a blank.
  const dues = await page.getByTestId("task-due").allTextContents();
  expect(dues.filter((due) => due === NO_DUE).length).toBeGreaterThanOrEqual(2);
});

test("TB-005 filters the task list to the open tasks", async ({ page }) => {
  await page.goto("/tasks?status=open");
  const statuses = await page.getByTestId("task-status").allTextContents();
  expect(statuses.length).toBeGreaterThan(0);
  expect(statuses.filter((status) => status !== "open")).toEqual([]);
  const titles = await page.getByTestId("task-title").allTextContents();
  for (const title of SEEDED_OPEN) expect(titles).toContain(title);
  expect(titles).not.toContain(SEEDED_DONE);
});

test("TB-006 filters the task list to the done tasks", async ({ page }) => {
  await page.goto("/tasks?status=done");
  const statuses = await page.getByTestId("task-status").allTextContents();
  expect(statuses.length).toBeGreaterThan(0);
  expect(statuses.filter((status) => status !== "done")).toEqual([]);
  const titles = await page.getByTestId("task-title").allTextContents();
  expect(titles).toContain(SEEDED_DONE);
  for (const title of SEEDED_OPEN) expect(titles).not.toContain(title);
});

test("TB-007 sorts the task list by due date with undated tasks last", async ({ page }) => {
  await page.goto("/tasks?sort=due");
  const dues = await page.getByTestId("task-due").allTextContents();
  expect(dues, "the seed has undated tasks, so this check is not vacuous").toContain(NO_DUE);

  const dated = dues.filter((due) => due !== NO_DUE);
  expect(dated.length, "the seed has dated tasks too").toBeGreaterThan(0);
  // ISO dates sort lexicographically, so ascending order is a plain string sort.
  expect(dated).toEqual([...dated].sort());

  const lastDated = dues.lastIndexOf(dated[dated.length - 1]);
  const firstUndated = dues.indexOf(NO_DUE);
  expect(firstUndated, "every undated task comes after every dated one").toBeGreaterThan(lastDated);
});

test("TB-008 opens a task's detail page", async ({ page }) => {
  await page.goto("/tasks/1");
  await expect(page.getByTestId("task-title")).toHaveText("Draft the release notes");
  await expect(page.getByTestId("task-status")).toHaveText("open");
  await expect(page.getByTestId("task-due")).toHaveText("2026-10-02");
});

test("TB-009 answers an unknown task id with a 404 page", async ({ page }) => {
  const response = await page.goto("/tasks/999");
  expect(response?.status()).toBe(404);
  // A page, not a JSON error — the contract draws that line between /tasks/:id and /api/tasks/:id.
  expect(response?.headers()["content-type"]).toContain("text/html");
  await expect(page.getByRole("heading", { level: 1, name: "Not found" })).toBeVisible();
});
