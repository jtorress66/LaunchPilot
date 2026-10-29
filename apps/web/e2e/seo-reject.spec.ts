import { expect, test } from "@playwright/test";
import { onSeoPage } from "./helpers";

test("a founder rejects a drafted article, then drafts that keyword again", async ({ page }) => {
  await onSeoPage(page);
  const seoPage = page.url();
  await page.getByLabel("Topics your customers search for").fill("privacy analytics");
  await page.getByRole("button", { name: "Plan articles" }).click();
  const row = page.getByTestId("planned-article").first();
  await row.getByRole("button", { name: "Draft article" }).click();
  await expect(page).toHaveURL(/\/app\/content\/[^/]+$/);
  const rejectedUrl = page.url();
  const title = await page.getByLabel("Title").inputValue();

  await page.getByText("Reject this article").click();
  await page.getByLabel("Reason (optional)").fill("Not for our audience");
  await page.getByRole("button", { name: "Reject article" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Rejected");
  await expect(page.getByText("Rejection reason: Not for our audience")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve article" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publish to blog" })).toHaveCount(0);

  await page.goto(seoPage);
  await expect(row.getByTestId("content-status")).toHaveText("Rejected");
  await row.getByRole("button", { name: "Draft again" }).click();
  await expect(page).toHaveURL(/\/app\/content\/[^/]+$/);
  expect(page.url()).not.toBe(rejectedUrl);
  await expect(page.getByTestId("content-status")).toHaveText("Waiting for your approval");

  await page.goto(seoPage);
  await expect(row.getByTestId("content-status")).toHaveText("Waiting for your approval");
  await expect(row.getByRole("button", { name: "Draft again" })).toHaveCount(0);

  await page
    .getByRole("navigation", { name: "App" })
    .getByRole("link", { name: "Activity" })
    .click();
  await expect(page.getByRole("list", { name: "Activity" })).toContainText(
    `You rejected “${title}”`,
  );
});
