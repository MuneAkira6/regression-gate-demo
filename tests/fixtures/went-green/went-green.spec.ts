// A gate fixture: never run by `pnpm e2e`. Passes on purpose.
// Its id IS declared, so a pass makes the gate report WENT GREEN — reported only, with the advice to
// verify on one build and remove the declaration by hand.

import { expect, test } from "@playwright/test";

test("TB-903 was declared red and now passes", async ({ request }) => {
  const response = await request.get("/version");
  expect(response.status()).toBe(200);
});
