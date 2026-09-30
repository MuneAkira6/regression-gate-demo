// A gate fixture: never run by `pnpm e2e`.
//
// This one redeploys the app in the middle of its own unit — a real mid-run change of the version
// under test, not a forged report — and then fails. Its id is not declared, so the gate must call it
// INCONCLUSIVE rather than NEW RED: a run that spanned two builds says nothing about either.

import { expect, test } from "@playwright/test";

test("TB-904 fails while the version under test changes", async ({ request }) => {
  const before = (await (await request.get("/version")).json()) as { version: string };
  await request.post("/__admin/deploy", { data: { version: "9.9.9" } });
  const after = (await (await request.get("/version")).json()) as { version: string };
  console.log(`TB-904 redeployed mid-unit: ${before.version} -> ${after.version}`);
  // Fails on purpose, and for a real reason: the version did move.
  expect(after.version).toBe(before.version);
});
