import { expect, test } from "@playwright/test";
import { draftBrief, onBriefPage } from "./helpers";

// Build step 5 gate: paste URL → brief drafted → edited → approved.
test("a founder pastes their URL, gets a brief drafted from the site, edits and approves it", async ({
  page,
}) => {
  await onBriefPage(page);
  await expect(page.getByRole("heading", { name: "Product Brief" })).toBeVisible();
  await expect(page.getByText("No brief yet")).toBeVisible();

  await draftBrief(page);
  await expect(page.getByTestId("brief-status")).toHaveText("Draft");
  await expect(page.getByLabel("Audience")).toHaveValue("SaaS founders");
  await expect(page.getByLabel("Problem")).toHaveValue(
    "Founders waste hours in bloated dashboards that track everything but answer nothing.",
  );
  const facts = page.getByLabel("Product facts");
  await expect(facts).toHaveValue(/Start with a free 14-day trial\./);
  await expect(facts).toHaveValue(/Acme is GDPR compliant and never uses cookies\./);

  await page.getByLabel("Audience").fill("Bootstrapped SaaS founders who hate cookie banners");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");

  await page.getByRole("button", { name: "Approve brief" }).click();
  await expect(page.getByTestId("brief-status")).toHaveText("Approved");

  await page.reload();
  await expect(page.getByLabel("Audience")).toHaveValue(
    "Bootstrapped SaaS founders who hate cookie banners",
  );
  await expect(page.getByTestId("brief-status")).toHaveText("Approved");

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Acme Analytics" })).toContainText(
    "Brief approved",
  );
});
