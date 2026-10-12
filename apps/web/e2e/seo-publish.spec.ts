import { expect, test } from "@playwright/test";
import { connectWordPress, onSeoPage } from "./helpers";

// Build step 6 gate: article drafted → approved → published to a test blog (real WordPress).
test("a founder plans SEO articles, approves one and publishes it to their WordPress blog", async ({
  page,
}) => {
  await onSeoPage(page);

  await connectWordPress(page);
  await expect(page.getByRole("status")).toContainText("Connected to LaunchPilot E2E Blog");

  await page.getByLabel("Topics your customers search for").fill("privacy analytics");
  await page.getByRole("button", { name: "Plan articles" }).click();
  const planned = page.getByTestId("planned-article");
  await expect(planned.first()).toContainText("cookieless analytics");
  await expect(planned.first()).toContainText("searches/month");

  await planned.first().getByRole("button", { name: "Draft article" }).click();
  await expect(page).toHaveURL(/\/app\/content\/[^/]+$/);
  await expect(page.getByTestId("content-status")).toHaveText("Waiting for your approval");
  await expect(page.getByRole("button", { name: "Publish to blog" })).toBeDisabled();

  const title = `Cookieless analytics for SaaS founders ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");

  await page.getByRole("button", { name: "Approve article" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Approved");

  await page.getByRole("button", { name: "Publish to blog" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Published");
  const live = page.getByRole("status").getByRole("link");
  const href = await live.getAttribute("href");
  expect(href).toBeTruthy();

  // The post is really live on the WordPress blog.
  await page.goto(href ?? "");
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  await expect(page.getByText("Free 14-day trial", { exact: false }).first()).toBeVisible();
});
