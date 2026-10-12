import { expect, test, type Page } from "@playwright/test";
import { connectWordPress, draftBrief, onBriefPage, onSeoPage } from "./helpers";

const main = (page: Page) => page.getByRole("main");

test("SEO planning waits until the Product Brief is approved", async ({ page }) => {
  await onBriefPage(page);
  await draftBrief(page);
  await page.goto(page.url().replace(/\/brief$/, "/seo"));
  await expect(main(page).getByRole("alert")).toContainText("Approve your Product Brief first");
  await expect(page.getByRole("button", { name: "Plan articles" })).toHaveCount(0);
});

test("a wrong Application Password is refused and nothing is connected", async ({ page }) => {
  await onSeoPage(page);
  await connectWordPress(page, "wrong wrong wrong wrong");
  await expect(main(page).getByRole("alert")).toContainText(
    "WordPress did not accept that username and Application Password",
  );
  await expect(page.getByRole("button", { name: "Connect blog" })).toBeVisible();
});

test("an article cannot be published before it is approved, nor while edits are unsaved", async ({
  page,
}) => {
  await onSeoPage(page);
  await page.getByLabel("Topics your customers search for").fill("privacy analytics");
  await page.getByRole("button", { name: "Plan articles" }).click();
  await page
    .getByTestId("planned-article")
    .first()
    .getByRole("button", { name: "Draft article" })
    .click();
  await expect(page.getByRole("button", { name: "Publish to blog" })).toBeDisabled();
  await page.getByLabel("Title").fill("Edited title");
  await expect(page.getByRole("button", { name: "Approve article" })).toBeDisabled();
  await expect(page.getByText("Save your changes first.")).toBeVisible();
});
