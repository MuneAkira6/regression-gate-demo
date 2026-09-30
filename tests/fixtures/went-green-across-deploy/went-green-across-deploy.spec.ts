// A gate fixture: never run by `pnpm e2e`.
//
// A declared id that passes, in a unit that redeploys halfway through. The gate must report WENT GREEN
// and add that it happened across a redeployment, so nobody reads the pass as evidence of a fix.

import { expect, test } from "@playwright/test";

test("TB-905 was declared red and passes across a redeployment", async ({ request }) => {
  const before = (await (await request.get("/version")).json()) as { version: string };
  await request.post("/__admin/deploy", { data: { version: "3.0.0" } });
  const after = (await (await request.get("/version")).json()) as { version: string };
  console.log(`TB-905 redeployed mid-unit: ${before.version} -> ${after.version}`);
  expect(after.version).toBe("3.0.0");
});
