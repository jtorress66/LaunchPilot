import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { ayrshareStub, draftSocialWeek, onSocialPage, openFirstXPostFromInbox } from "./helpers";

interface StubPost {
  readonly post: string;
  readonly platforms: readonly string[];
}

// Build step 7 gate: post approved → published to a sandbox account (local Ayrshare stub).
test("a founder links X, approves a drafted post from the inbox and publishes it", async ({
  page,
  request,
}) => {
  await onSocialPage(page);

  // Link accounts on the provider's page and come back.
  await page.getByRole("button", { name: "Connect X and LinkedIn" }).click();
  await expect(page.getByRole("heading", { name: "Link your social accounts" })).toBeVisible();
  await page.getByRole("button", { name: "Link X and LinkedIn" }).click();
  await expect(page).toHaveURL(/\/social\?linked=1$/);
  await expect(page.getByRole("status")).toContainText("Linked: X and LinkedIn");

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
  await expect(live).toHaveAttribute("href", new RegExp(`^${ayrshareStub()}/posts/`));

  // Exactly that text went to X (Ayrshare's "twitter"), once.
  const posts = (await (await request.get(`${ayrshareStub()}/_stub/posts`)).json()) as StubPost[];
  const sent = posts.filter((p) => p.post === text);
  expect(sent).toEqual([expect.objectContaining({ post: text, platforms: ["twitter"] })]);
});
