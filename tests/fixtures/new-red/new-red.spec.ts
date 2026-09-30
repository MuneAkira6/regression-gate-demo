// A gate fixture: not part of the regression suite, and never run by `pnpm e2e`.
//
// This test fails on purpose. Its id is not declared in the known-reds file the gate is given and no
// redeployment happens during its unit, so the gate must classify it NEW RED.

import { expect, test } from "@playwright/test";

test("TB-901 fails on a build that did not change", async ({ request }) => {
  const response = await request.post("/api/notifications/test");
  const body = (await response.json()) as Record<string, unknown>;
  // Fails on purpose: the contract says this endpoint answers 503 with an error.
  expect(body).toEqual({ sent: true });
});
