import { expect, test } from "@playwright/test";
import { approveLaunchKit, generateLaunchKit, onLaunchPage, trackerRow } from "./helpers";

test("a Show HN draft is approved in the inbox and posted by hand, never published by Nuvantre", async ({
  page,
}) => {
  await onLaunchPage(page);
  const launchUrl = page.url();
  await generateLaunchKit(page);
  await approveLaunchKit(page);

  // Show HN is on the tracker, but its draft post is not approved yet.
  await page.getByRole("link", { name: "Communities", exact: true }).click();
  await page.getByRole("button", { name: "Add Show HN (Hacker News) to my launch" }).click();
  const showHn = trackerRow(page, "Show HN (Hacker News)");
  await showHn.getByRole("button", { name: "Mark submitted" }).click();
  await expect(showHn.getByText("Approve the draft post for this community first")).toBeVisible();

  // The draft is waiting in the inbox; its page offers copy-and-post, never Publish.
  await page.goto("/app/inbox");
  const entry = page.getByRole("listitem").filter({ hasText: "Show HN: Acme Analytics" });
  await entry.getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("link", { name: "Open Show HN" })).toHaveAttribute(
    "href",
    "https://news.ycombinator.com/submit",
  );
  await expect(page.getByRole("button", { name: /Publish/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Schedule/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Approve post" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Approved");

  await page.goto(launchUrl);
  await trackerRow(page, "Show HN (Hacker News)")
    .getByRole("button", { name: "Mark submitted" })
    .click();
  await expect(
    trackerRow(page, "Show HN (Hacker News)").getByTestId("submission-status"),
  ).toHaveText("Submitted");
});
