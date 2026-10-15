import { expect, test } from "@playwright/test";
import { approveLaunchKit, generateLaunchKit, onLaunchPage, trackerRow } from "./helpers";

// Build step 8 gate: a launch kit generated for a sample product; tracker statuses update.
test("a founder generates a launch kit, approves it and tracks submissions to directories", async ({
  page,
}) => {
  await onLaunchPage(page);
  await generateLaunchKit(page);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Acme Analytics");
  await expect(page.getByLabel("Tagline")).not.toHaveValue("");
  await expect(page.getByLabel("Short description")).not.toHaveValue("");

  // Product Hunt is free; BetaList needs the Paid filter.
  await page.getByRole("button", { name: "Add Product Hunt to my launch" }).click();
  await expect(trackerRow(page, "Product Hunt")).toBeVisible();
  await page.getByRole("link", { name: "Paid", exact: true }).click();
  await page.getByRole("button", { name: "Add BetaList to my launch" }).click();
  await expect(trackerRow(page, "BetaList")).toBeVisible();

  // Nothing counts as submitted before the founder approves the kit.
  const productHunt = trackerRow(page, "Product Hunt");
  await productHunt.getByRole("button", { name: "Mark submitted" }).click();
  await expect(productHunt.getByText("Approve the launch kit before submitting")).toBeVisible();

  await page.getByLabel("Tagline").fill("Five numbers that matter, every Monday");
  await page.getByRole("button", { name: "Save kit" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await approveLaunchKit(page);

  await productHunt.getByRole("button", { name: "Mark submitted" }).click();
  await expect(productHunt.getByTestId("submission-status")).toHaveText("Submitted");
  await productHunt
    .getByLabel("Listing URL")
    .fill("https://www.producthunt.com/posts/acme-analytics");
  await productHunt.getByRole("button", { name: "Mark live" }).click();
  await expect(productHunt.getByTestId("submission-status")).toHaveText("Live");

  const betaList = trackerRow(page, "BetaList");
  await betaList.getByRole("button", { name: "Mark submitted" }).click();
  await expect(betaList.getByTestId("submission-status")).toHaveText("Submitted");
  await betaList.getByLabel("Rejection reason").fill("Not accepting analytics tools this month");
  await betaList.getByRole("button", { name: "Mark rejected" }).click();
  await expect(betaList.getByTestId("submission-status")).toHaveText("Rejected");
  await betaList.getByRole("button", { name: "Reopen" }).click();
  await expect(betaList.getByTestId("submission-status")).toHaveText("Planned");

  // The tracker is stored, not just on screen.
  await page.reload();
  await expect(trackerRow(page, "Product Hunt").getByTestId("submission-status")).toHaveText(
    "Live",
  );
  await expect(
    trackerRow(page, "Product Hunt").getByRole("link", {
      name: "https://www.producthunt.com/posts/acme-analytics",
    }),
  ).toBeVisible();
  await expect(trackerRow(page, "BetaList").getByTestId("submission-status")).toHaveText("Planned");
  await expect(page.getByText("1 planned · 0 submitted · 1 live")).toBeVisible();
});
