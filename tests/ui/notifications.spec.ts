// The notification settings screen.

import { expect, test } from "@playwright/test";

test("TB-010 offers a test email on the notification settings page", async ({ page }) => {
  await page.goto("/settings/notifications");
  await expect(page.getByTestId("send-test-email")).toBeVisible();
  await expect(page.getByTestId("send-test-email")).toHaveText("Send a test email");
});

test("TB-011 sends a test email to the recipient", async ({ page }) => {
  await page.goto("/settings/notifications");

  // The network watch is armed before the click, not after, so the response cannot be missed in the
  // gap between the two.
  const sent = page.waitForResponse("**/api/notifications/test");
  await page.getByTestId("send-test-email").click();
  await sent;

  // The contract: the test email is sent. That is the product's specified behaviour, so this
  // assertion stays exactly as written even though this demo has no mail transport and the case is
  // therefore red. Rewriting it to expect the failure would delete the only signal that the feature
  // does not work; the red is declared in known-reds.yml instead, with its reason.
  await expect(page.getByTestId("test-email-result")).toHaveText("Test email sent");
});
