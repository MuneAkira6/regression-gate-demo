// The /api/notifications endpoint group.

import { expect, test } from "@playwright/test";

test("TB-021 reports that there is no mail transport", async ({ request }) => {
  const response = await request.post("/api/notifications/test");
  // 503 is what the contract specifies for this demo, so unlike the UI case TB-011 this one is
  // green: the endpoint is doing what it was specified to do.
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ error: "mail transport unavailable" });
});
