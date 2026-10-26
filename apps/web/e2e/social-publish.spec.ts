import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { draftSocialWeek, onSocialPage, openFirstXPostFromInbox, zernioStub } from "./helpers";

interface StubPost {
  readonly content: string;
  readonly platforms: readonly { readonly platform: string; readonly accountId: string }[];
}

// Build step 7 gate: post approved → published to a sandbox account (local Zernio stub).
test("a founder links X through Zernio, approves a drafted post from the inbox and publishes it", async ({
  page,
  request,
}) => {
  await onSocialPage(page);

  // Link X on the platform's consent page (through Zernio) and come back.
  await page.getByRole("button", { name: "Connect X" }).click();
  await expect(page.getByRole("heading", { name: "Authorize Nuvantre on X" })).toBeVisible();
  await page.getByRole("button", { name: "Authorize" }).click();
  await expect(page).toHaveURL(/\/social\?linked=1$/);
  await expect(page.getByRole("status")).toContainText("Linked: X");
  await expect(page.getByRole("button", { name: "Reconnect X" })).toBeVisible();

  await draftSocialWeek(page);
  await expect(page.getByRole("link", { name: "Inbox (5)" })).toBeVisible();

  // Make the post unique so the stub's record can be matched to this test.
  await openFirstXPostFromInbox(page);
  const postUrl = page.url();
  await expect(page.getByTestId("content-status")).toHaveText("Waiting for your approval");
  await expect(page.getByRole("button", { name: "Publish now" })).toBeDisabled();
  const text = `Cookie-free analytics, five numbers a week. ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("X post").fill(text);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");

  // Approve from the inbox.
  await page.goto("/app/inbox");
  const entry = page.getByRole("listitem").filter({ hasText: text });
  await entry.getByRole("button", { name: /^Approve/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: text })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Inbox (4)" })).toBeVisible();

  // Publish now from the post page.
  await page.goto(postUrl);
  await expect(page.getByTestId("content-status")).toHaveText("Approved");
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Published");
  const live = page.getByRole("status").getByRole("link");
  await expect(live).toHaveAttribute("href", new RegExp(`^${zernioStub()}/posts/`));

  // Exactly that text went to the linked X account (Zernio's "twitter"), once.
  const posts = (await (await request.get(`${zernioStub()}/_stub/posts`)).json()) as StubPost[];
  const sent = posts.filter((p) => p.content === text);
  expect(sent).toHaveLength(1);
  expect(sent[0]?.platforms).toEqual([{ platform: "twitter", accountId: expect.any(String) }]);
});
