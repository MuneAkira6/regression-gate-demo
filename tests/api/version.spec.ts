// The /version endpoint. This is the reading the gate takes before and after every unit, which is
// how it tells a red that crossed a redeployment from one that did not.

import { expect, test } from "@playwright/test";

test("TB-022 reports the version under test", async ({ request }) => {
  const response = await request.get("/version");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { version: string; build: string };
  expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(body.build).toMatch(/^[0-9a-f]{12}$/);
  // The contract seeds the version at 1.4.0 and nothing in this suite deploys, so a fresh app
  // reports it. If a redeployment ever crosses this unit the reading changes and the gate says
  // INCONCLUSIVE — which is the right answer, not a reason to loosen the assertion.
  expect(body.version).toBe("1.4.0");
});
