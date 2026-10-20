import { expect, test } from "@playwright/test";
import { analyticsStub, connectPlausible, onAnalyticsPage } from "./helpers";

test("a report is still built when a source fails, and says which one and why", async ({
  page,
  request,
}, testInfo) => {
  await onAnalyticsPage(page);
  const key = await connectPlausible(page, testInfo.project.name);
  // The founder deletes the key in Plausible after connecting.
  await request.post(`${analyticsStub().url}/_stub/plausible/revoke`, { data: { key } });

  await page.getByRole("button", { name: "Build report now" }).click();
  await expect(page).toHaveURL(/\/analytics\/\d{4}-W\d{2}$/);
  const sources = page.getByRole("list", { name: "Sources" });
  await expect(sources).toContainText("Plausible: Plausible rejected the API key");
  await expect(sources).toContainText("Search Console: not connected");
  await expect(page.getByText("No source returned figures for this week.")).toBeVisible();
  await expect(page.getByTestId("analyst-notes")).toContainText("No figures this week");
});

test("declining Google's consent connects nothing and says so", async ({ page }) => {
  await onAnalyticsPage(page);
  await page.getByRole("link", { name: "Connect Google" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Google access was not granted." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect Google" })).toBeVisible();
});
