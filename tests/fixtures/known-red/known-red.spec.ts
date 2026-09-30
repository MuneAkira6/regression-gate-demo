// A gate fixture: never run by `pnpm e2e`. Fails on purpose.
// Its id IS declared in the known-reds file the self-test hands the gate, so the gate must call it
// KNOWN RED and not count it as a failure.

import { expect, test } from "@playwright/test";

test("TB-902 is declared red and still fails", async ({ request }) => {
  const body = (await (await request.post("/api/notifications/test")).json()) as unknown;
  expect(body).toEqual({ sent: true });
});
