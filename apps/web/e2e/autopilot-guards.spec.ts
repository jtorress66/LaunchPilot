import { expect, test } from "@playwright/test";
import { onAnalyticsPage } from "./helpers";

// Build step 10: the autopilot works only from an approved brief, and never publishes by itself.
test("running the week without an approved brief explains why and drafts nothing", async ({
  page,
}) => {
  await onAnalyticsPage(page);

  const card = page.getByRole("region", { name: "Weekly autopilot" });
  await card.getByRole("button", { name: "Run this week now" }).click();
  await expect(card.getByRole("alert")).toHaveText("Approve the Product Brief first");
  await page.reload();
  await expect(page.getByTestId("autopilot-latest")).toContainText(
    "Skipped: Approve the Product Brief first",
  );

  await page.goto("/app/inbox");
  await expect(page.getByText("You are all caught up.")).toBeVisible();
});
