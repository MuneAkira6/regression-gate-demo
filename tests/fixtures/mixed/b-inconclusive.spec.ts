// A gate fixture: never run by `pnpm e2e`. The *last* unit of the "mixed" directory in file-name
// order, deliberately: it redeploys, and a deploy changes the version for every later unit of the
// same run, so putting it last keeps it from contaminating the NEW RED in a-new-red.spec.ts.

import { expect, test } from "@playwright/test";

test("TB-907 fails while the version under test changes", async ({ request }) => {
  const before = (await (await request.get("/version")).json()) as { version: string };
  await request.post("/__admin/deploy", { data: { version: "4.5.6" } });
  const after = (await (await request.get("/version")).json()) as { version: string };
  console.log(`TB-907 redeployed mid-unit: ${before.version} -> ${after.version}`);
  expect(after.version).toBe(before.version);
});
