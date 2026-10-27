import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectWordPress, onSeoPage, wordpress } from "./helpers";

// Build step 6 gate: article drafted → approved → published to a test blog (real WordPress).
test("a founder plans SEO articles, approves one and publishes it to their WordPress blog", async ({
  page,
}) => {
  await onSeoPage(page);

  await connectWordPress(page);
  await expect(page.getByRole("status")).toContainText("Connected to Nuvantre E2E Blog");

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

interface WordPressPost {
  readonly slug: string;
  readonly excerpt: { readonly rendered: string };
  readonly content: { readonly rendered: string };
}

// Build step 10.5 gate: a later article links to an earlier one and goes out with its slug and
// excerpt (real WordPress, read back through its REST API).
test("a second article links to the first and is published with its own slug and excerpt", async ({
  page,
  request,
}) => {
  await onSeoPage(page);
  await connectWordPress(page);
  await expect(page.getByRole("status")).toContainText("Connected to Nuvantre E2E Blog");
  await page.getByLabel("Topics your customers search for").fill("privacy analytics");
  await page.getByRole("button", { name: "Plan articles" }).click();
  const planned = page.getByTestId("planned-article");
  await expect(planned.first()).toContainText("searches/month");
  const seoPage = page.url();

  // Publish a first article.
  await planned.first().getByRole("button", { name: "Draft article" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Waiting for your approval");
  await page.getByRole("button", { name: "Approve article" }).click();
  await page.getByRole("button", { name: "Publish to blog" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Published");
  const first = (await page.getByRole("status").getByRole("link").getAttribute("href")) ?? "";
  expect(first).toMatch(/^https?:\/\//);

  // The next article may link to it, and only to it.
  await page.goto(seoPage);
  await page
    .getByTestId("planned-article")
    .nth(1)
    .getByRole("button", { name: "Draft article" })
    .click();
  await expect(page.getByTestId("content-status")).toHaveText("Waiting for your approval");
  expect(await page.getByLabel("Article (Markdown)").inputValue()).toContain(`(${first})`);
  await expect(page.getByLabel("URL slug")).not.toHaveValue("");
  await expect(page.getByLabel("Excerpt")).not.toHaveValue("");

  // The founder chooses the slug and excerpt, then approves and publishes.
  const slug = `privacy-first-analytics-${randomUUID().slice(0, 8)}`;
  const excerpt = "How SaaS founders measure what matters without cookie banners.";
  await page.getByLabel("URL slug").fill(slug);
  await page.getByLabel("Excerpt").fill(excerpt);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await expect(page.getByLabel("URL slug")).toHaveValue(slug);
  await page.getByRole("button", { name: "Approve article" }).click();
  await page.getByRole("button", { name: "Publish to blog" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Published");

  // WordPress has the post under that slug, with the excerpt and the link to the first article.
  const response = await request.get(`${wordpress().url}/?rest_route=/wp/v2/posts&slug=${slug}`);
  const [post] = (await response.json()) as WordPressPost[];
  expect(post?.slug).toBe(slug);
  expect(post?.excerpt.rendered).toContain(excerpt);
  expect(post?.content.rendered).toContain(`href="${first}"`);
});
