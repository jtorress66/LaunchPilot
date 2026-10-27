import { expect, test } from "@playwright/test";
import { FIXTURE_SITE, onSeoPage } from "./helpers";

interface KeywordRequest {
  readonly keywords: readonly string[];
  readonly location_code: number;
  readonly language_code: string;
}

// Build step 10.5 gate: a product in another language plans and drafts for its own market.
test("a founder switches the product to Brazilian Portuguese and plans articles for that market", async ({
  page,
  request,
}) => {
  await onSeoPage(page);

  await page.getByLabel("Language", { exact: true }).selectOption({ label: "Portuguese" });
  await page.getByLabel("Market", { exact: true }).selectOption({ label: "Brazil" });
  await page.getByRole("button", { name: "Save language" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Articles and posts are now written in Portuguese (Brazil).",
  );
  await page.reload();
  await expect(page.getByLabel("Language", { exact: true })).toHaveValue("pt");
  await expect(page.getByLabel("Market", { exact: true })).toHaveValue("BR");

  // Keyword research asks DataForSEO for Brazil, in Portuguese (the local stub records requests).
  const topic = `análise sem cookies ${String(Date.now())}`;
  await page.getByLabel("Topics your customers search for").fill(topic);
  await page.getByRole("button", { name: "Plan articles" }).click();
  const planned = page.getByTestId("planned-article");
  await expect(planned.first()).toContainText("searches/month");
  const sent = (await (
    await request.get(new URL("/dataforseo/_stub/requests", FIXTURE_SITE).toString())
  ).json()) as KeywordRequest[];
  expect(sent.find((r) => r.keywords.includes(topic))).toMatchObject({
    location_code: 2076,
    language_code: "pt",
  });

  await planned.first().getByRole("button", { name: "Draft article" }).click();
  await expect(page).toHaveURL(/\/app\/content\/[^/]+$/);
  await expect(page.getByTestId("content-status")).toHaveText("Waiting for your approval");
  await expect(page.getByLabel("URL slug")).not.toHaveValue("");
});
