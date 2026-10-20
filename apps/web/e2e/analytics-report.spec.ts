import { expect, test } from "@playwright/test";
import { connectPlausible, metricTile, onAnalyticsPage } from "./helpers";

// Build step 9: a founder connects Google and Plausible and reads a weekly report built from
// the recorded Search Console, GA4 and Plausible responses served by the local stand-in.
test("a founder connects Google and Plausible and reads the weekly report", async ({
  page,
}, testInfo) => {
  await onAnalyticsPage(page);

  await page.getByRole("link", { name: "Connect Google" }).click();
  await expect(
    page.getByRole("heading", { name: "LaunchPilot wants read-only access" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Allow" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Google is connected. Choose the properties to report on.",
  );
  await expect(page.getByTestId("google-account")).toHaveText("Connected as founder@acme.dev");

  await page.getByLabel("Search Console property").selectOption("sc-domain:acme.dev");
  await page.getByLabel("GA4 property").selectOption("412345678");
  await page.getByRole("button", { name: "Save properties" }).click();
  await expect(page.getByRole("status")).toHaveText("Properties saved.");
  await expect(page.getByLabel("GA4 property")).toHaveValue("412345678");

  await connectPlausible(page, testInfo.project.name);
  await expect(page.getByTestId("plausible-site")).toHaveText("acme.dev on 127.0.0.1:4030");

  await page.getByRole("button", { name: "Build report now" }).click();
  await expect(page).toHaveURL(/\/analytics\/\d{4}-W\d{2}$/);
  await expect(page.getByRole("heading", { name: /^Weekly report \d{4}-W\d{2}$/ })).toBeVisible();

  // GA4 wins over Plausible for visitors; every change is against the week before.
  for (const [metric, value, change] of [
    ["visitors", "1,432", "+13%"],
    ["pageviews", "3,876", "+11%"],
    ["search_clicks", "182", "+21%"],
    ["search_impressions", "6,240", "+4%"],
    ["search_ctr", "2.9%", "+16%"],
    ["search_position", "17.4", "−8%"],
  ] as const) {
    await expect(metricTile(page, metric)).toContainText(value);
    await expect(metricTile(page, metric).getByTestId("change")).toHaveText(change);
  }
  await expect(page.getByTestId("analyst-notes")).toContainText(
    "Search clicks rose 21% to 182 compared with the week before.",
  );
  await expect(page.getByRole("table", { name: "Top pages" })).toContainText("/pricing");
  await expect(page.getByRole("table", { name: "Top searches" })).toContainText(
    "cookieless analytics",
  );
  const sources = page.getByRole("list", { name: "Sources" });
  await expect(sources).toContainText("Search Console: ok");
  await expect(sources).toContainText("Google Analytics 4: ok");
  await expect(sources).toContainText("Plausible: ok");

  // The report is stored: it is the latest one on the Analytics page after a reload.
  await page.getByRole("link", { name: "Acme Analytics · Analytics" }).click();
  await page.reload();
  await expect(metricTile(page, "visitors")).toContainText("1,432");
});
