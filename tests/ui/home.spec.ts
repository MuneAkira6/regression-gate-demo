// Every title starts with the id of its row in catalog/cases.csv, so the coverage report can join
// the sheet and the suite on that id and the gate can classify a failure by the case it belongs to.

import { expect, test } from "@playwright/test";
import { readStable } from "../../tools/stable-read.ts";
import { stableReadN } from "../controls.ts";

test("TB-001 opens the home page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Acme Tasks");
  await expect(page.getByRole("heading", { level: 1, name: "Acme Tasks" })).toBeVisible();
  await expect(page.getByTestId("today-counter")).toBeVisible();
});

test("TB-002 shows the number of open tasks in the today counter", async ({ page, request }) => {
  const openTasks = await (await request.get("/api/tasks?status=open")).json();
  const expected = String(openTasks.length);

  // First, the raw read — no settling at all, sampled in a tight loop so nothing is slept on. This
  // is what a single read of this control is worth: a number that is true for one frame. The loop
  // collapses consecutive duplicates, so what it prints is the series of values the page rendered.
  await page.goto("/");
  const counter = page.getByTestId("today-counter");
  const series: string[] = [];
  const until = Date.now() + 1500;
  while (Date.now() < until) {
    const raw = (await counter.textContent()) ?? "";
    if (series[series.length - 1] !== raw) series.push(raw);
    if (series.length > 1 && series[series.length - 1] === expected) break;
  }
  console.log(`TB-002 raw reads (consecutive duplicates collapsed): ${JSON.stringify(series)}`);
  expect(series.length, "the counter must render values in between, not jump").toBeGreaterThan(1);
  expect(series[0]).toBe("0");

  // Now the same control through the stable read, on a fresh ramp. n comes from the control sheet.
  const n = stableReadN("today-counter");
  await page.goto("/");
  const stable = await readStable(async () => (await counter.textContent()) ?? "", { n });
  console.log(`TB-002 readStable(n=${n}) returned ${JSON.stringify(stable)}`);
  expect(stable).toBe(expected);
});
