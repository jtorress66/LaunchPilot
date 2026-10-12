import { expect, test, type Page } from "@playwright/test";
import { draftBrief, onBriefPage } from "./helpers";

const main = (page: Page) => page.getByRole("main");

test("editing an approved brief returns it to draft until it is approved again", async ({
  page,
}) => {
  await onBriefPage(page);
  await draftBrief(page);
  await page.getByRole("button", { name: "Approve brief" }).click();
  await expect(page.getByTestId("brief-status")).toHaveText("Approved");
  await expect(page.getByText("Saving changes returns the brief to draft")).toBeVisible();

  await page.getByLabel("Tone").fill("Playful");
  await expect(page.getByRole("button", { name: "Approve brief" })).toBeDisabled();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("brief-status")).toHaveText("Draft");
});

test("a brief without product facts cannot be approved", async ({ page }) => {
  await onBriefPage(page);
  await draftBrief(page);
  await page.getByLabel("Product facts").fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");

  await page.getByRole("button", { name: "Approve brief" }).click();
  await expect(main(page).getByRole("alert")).toContainText(
    "Add at least one product fact before approving",
  );
  await expect(page.getByTestId("brief-status")).toHaveText("Draft");
});

test("a site that cannot be reached is explained instead of drafted", async ({ page }) => {
  await onBriefPage(page, "http://127.0.0.1:4011/");
  await page.getByRole("button", { name: /Draft my brief/ }).click();
  await expect(main(page).getByRole("alert")).toContainText("We could not read your site");
  await expect(page.getByText("No brief yet")).toBeVisible();
});
