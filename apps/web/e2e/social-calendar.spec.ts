import { expect, test } from "@playwright/test";
import { draftSocialWeek, onSocialPage, openFirstXPostFromInbox } from "./helpers";

// Calendar days are UTC; running the browser in UTC keeps the chosen time on the expected day.
test.use({ timezoneId: "UTC" });

const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

test("a founder schedules an approved post onto the calendar and takes it off again", async ({
  page,
}) => {
  await onSocialPage(page);
  await draftSocialWeek(page);
  await openFirstXPostFromInbox(page);
  const postUrl = page.url();

  await page.getByRole("button", { name: "Approve post" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Approved");
  const day = tomorrow();
  await page.getByLabel("Schedule for").fill(`${day}T10:00`);
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Scheduled");

  await page.getByRole("link", { name: /· Social$/ }).click();
  const calendar = page.getByRole("list", { name: "Calendar" });
  await expect(calendar.locator(`li[data-date="${day}"]`).getByRole("link")).toHaveCount(1);

  await page.goto(postUrl);
  await page.getByRole("button", { name: "Unschedule" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Approved");
  await page.getByRole("link", { name: /· Social$/ }).click();
  await expect(calendar.locator(`li[data-date="${day}"]`).getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Unscheduled" }).getByRole("link")).toHaveCount(1);
});

test("an X post over 280 characters is refused, and nothing publishes before approval", async ({
  page,
}) => {
  await onSocialPage(page);
  await draftSocialWeek(page);
  await openFirstXPostFromInbox(page);

  await expect(page.getByRole("button", { name: "Publish now" })).toBeDisabled();
  await page.getByLabel("X post").fill("a".repeat(281));
  await expect(page.getByText("281 / 280 characters")).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Body must be at most 280 characters")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("content-status")).toHaveText("Waiting for your approval");
  await expect(page.getByRole("button", { name: "Publish now" })).toBeDisabled();
});
