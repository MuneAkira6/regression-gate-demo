// A gate fixture: never run by `pnpm e2e`. The first unit of the "mixed" directory, so it runs on a
// build that has not moved yet and must come out NEW RED.

import { expect, test } from "@playwright/test";

test("TB-906 fails on a build that did not change", async ({ request }) => {
  const response = await request.get("/api/tasks/999");
  expect(response.status()).toBe(200);
});
