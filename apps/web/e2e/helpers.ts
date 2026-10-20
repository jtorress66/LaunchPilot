import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

export const PASSWORD = "correct horse battery staple";

/** A fresh address per test, so tests can run in parallel against one database. */
export const uniqueEmail = () => `founder+${randomUUID().slice(0, 8)}@acme.dev`;

export const signUp = async (page: Page, email = uniqueEmail()) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/);
  return email;
};

export const addProduct = async (page: Page, name: string, url: string) => {
  await page.getByLabel("Product name").fill(name);
  await page.getByLabel("Website").fill(url);
  await page.getByRole("button", { name: "Add product" }).click();
};

/** The local fixture website served by scripts/e2e.mjs ("Acme Analytics"). */
export const FIXTURE_SITE = process.env.E2E_SITE_URL ?? "http://127.0.0.1:4010/";

/** Signs up, adds the fixture site as a product and lands on its brief page. */
export const onBriefPage = async (page: Page, url = FIXTURE_SITE) => {
  await signUp(page);
  await addProduct(page, "Acme Analytics", url);
  await expect(page).toHaveURL(/\/app\/products\/[^/]+\/brief$/);
};

export const draftBrief = async (page: Page) => {
  await page.getByRole("button", { name: /Draft my brief/ }).click();
  await expect(page.getByLabel("Audience")).not.toHaveValue("");
};

/** The real WordPress blog started by scripts/e2e.mjs, with an Application Password for admin. */
export const wordpress = () => {
  const url = process.env.E2E_WP_URL;
  const username = process.env.E2E_WP_USER;
  const password = process.env.E2E_WP_APP_PASSWORD;
  if (!url || !username || !password) throw new Error("Run E2E through `pnpm test:e2e`");
  return { url, username, password };
};

/** Signs up with a product whose brief is drafted and approved, then opens its SEO page. */
export const onSeoPage = async (page: Page) => {
  await onBriefPage(page);
  await draftBrief(page);
  await page.getByRole("button", { name: "Approve brief" }).click();
  await expect(page.getByTestId("brief-status")).toHaveText("Approved");
  await page.getByRole("link", { name: "Next: SEO →" }).click();
  await expect(page.getByRole("heading", { name: "SEO", exact: true })).toBeVisible();
};

export const connectWordPress = async (page: Page, password = wordpress().password) => {
  const wp = wordpress();
  await page.getByLabel("Blog address").fill(wp.url);
  await page.getByLabel("WordPress username").fill(wp.username);
  await page.getByLabel("Application Password").fill(password);
  await page.getByRole("button", { name: /Connect blog|Reconnect blog/ }).click();
};

/** The local Zernio stub started by scripts/e2e.mjs. */
export const zernioStub = () => {
  const url = process.env.E2E_ZERNIO_URL;
  if (!url) throw new Error("Run E2E through `pnpm test:e2e`");
  return url;
};

/** Signs up with an approved brief, then opens the product's Social page. */
export const onSocialPage = async (page: Page) => {
  await onBriefPage(page);
  await draftBrief(page);
  await page.getByRole("button", { name: "Approve brief" }).click();
  await expect(page.getByTestId("brief-status")).toHaveText("Approved");
  await page.goto(page.url().replace(/\/brief$/, "/social"));
  await expect(page.getByRole("heading", { name: "Social", exact: true })).toBeVisible();
};

/** Drafts the week's posts and waits for all five. */
export const draftSocialWeek = async (page: Page) => {
  await page.getByRole("button", { name: "Draft this week's posts" }).click();
  await expect(page.getByRole("list", { name: "Posts" }).getByRole("listitem")).toHaveCount(5);
};

/** Opens the first X post waiting in the inbox. */
export const openFirstXPostFromInbox = async (page: Page) => {
  await page.goto("/app/inbox");
  const xPost = page
    .getByRole("list", { name: "Waiting for approval" })
    .getByRole("listitem")
    .filter({ has: page.getByText("X", { exact: true }) })
    .first();
  await xPost.getByRole("link", { name: "Open" }).click();
  await expect(page.getByLabel("X post")).toBeVisible();
};

/** Signs up with an approved brief, then opens the product's Launch page. */
export const onLaunchPage = async (page: Page) => {
  await onBriefPage(page);
  await draftBrief(page);
  await page.getByRole("button", { name: "Approve brief" }).click();
  await expect(page.getByTestId("brief-status")).toHaveText("Approved");
  await page.goto(page.url().replace(/\/brief$/, "/launch"));
  await expect(page.getByRole("heading", { name: "Launch", exact: true })).toBeVisible();
};

export const generateLaunchKit = async (page: Page) => {
  await page.getByRole("button", { name: "Generate launch kit" }).click();
  await expect(page.getByTestId("kit-status")).toHaveText("Waiting for your approval");
};

export const approveLaunchKit = async (page: Page) => {
  await page.getByRole("button", { name: "Approve launch kit" }).click();
  await expect(page.getByTestId("kit-status")).toHaveText("Approved");
};

/** One directory's row on the tracker. */
export const trackerRow = (page: Page, name: string) =>
  page.getByRole("list", { name: "Submissions" }).getByRole("listitem", { name, exact: true });

/** The local Google and Plausible stand-in started by scripts/e2e.mjs. */
export const analyticsStub = () => {
  const url = process.env.E2E_ANALYTICS_URL;
  if (!url) throw new Error("E2E_ANALYTICS_URL is not set: run `pnpm test:e2e`");
  return { url, plausibleUrl: `${url}/plausible/` };
};

/** Signs up, adds the fixture product and opens its Analytics page. */
export const onAnalyticsPage = async (page: Page) => {
  await onBriefPage(page);
  await page.goto(page.url().replace(/\/brief$/, "/analytics"));
  await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();
};

/** Connects Plausible with a key unique to this test run, and returns the key. */
export const connectPlausible = async (page: Page, project: string) => {
  const key = `plausible-e2e-${project}-${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Site domain").fill("acme.dev");
  await page.getByLabel("Stats API key").fill(key);
  await page.getByLabel("Self-hosted address (optional)").fill(analyticsStub().plausibleUrl);
  await page.getByRole("button", { name: "Connect Plausible" }).click();
  await expect(page.getByRole("status")).toHaveText("Plausible is connected.");
  return key;
};

export const metricTile = (page: Page, name: string) => page.getByTestId(`metric-${name}`);
