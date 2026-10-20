import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { connectPlausible, connectWordPress, onSeoPage, zernioStub } from "./helpers";

interface StubPost {
  readonly content: string;
}

const inboxEntries = (page: Page, channel: string) =>
  page
    .getByRole("list", { name: "Waiting for approval" })
    .getByRole("listitem")
    .filter({ has: page.getByText(channel, { exact: true }) });

const productPage = (page: Page, section: string) =>
  page.url().replace(/\/products\/([^/]+)\/.*$/, `/products/$1/${section}`);

// Build step 10 gate: the whole weekly loop. Brief → connected channels → last week's report →
// autopilot plans, drafts and reviews the week → the founder approves and publishes.
test("autopilot plans, drafts and reviews the week, and the founder approves and publishes", async ({
  page,
  request,
}, testInfo) => {
  test.slow();
  await onSeoPage(page);
  await connectWordPress(page);
  await expect(page.getByRole("status")).toContainText("Connected to LaunchPilot E2E Blog");

  await page.goto(productPage(page, "social"));
  await page.getByRole("button", { name: "Connect X" }).click();
  await page.getByRole("button", { name: "Authorize" }).click();
  await expect(page.getByRole("status")).toContainText("Linked: X");

  // Last week's report: Google (Search Console and GA4) and Plausible through the stand-in.
  await page.goto(productPage(page, "analytics"));
  await page.getByRole("link", { name: "Connect Google" }).click();
  await page.getByRole("button", { name: "Allow" }).click();
  await page.getByLabel("Search Console property").selectOption("sc-domain:acme.dev");
  await page.getByLabel("GA4 property").selectOption("412345678");
  await page.getByRole("button", { name: "Save properties" }).click();
  await expect(page.getByRole("status")).toHaveText("Properties saved.");
  await connectPlausible(page, testInfo.project.name);
  await page.getByRole("button", { name: "Build report now" }).click();
  await expect(page.getByRole("heading", { name: /^Weekly report \d{4}-W\d{2}$/ })).toBeVisible();

  // Switch the autopilot on and run this week now.
  await page.goto(productPage(page, "analytics"));
  await expect(page.getByTestId("autopilot-state")).toHaveText("Off");
  await page.getByRole("button", { name: "Turn autopilot on" }).click();
  await expect(page.getByTestId("autopilot-state")).toHaveText("On");
  await page.getByRole("button", { name: "Run this week now" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "This week's run is done. Review the drafts in your Inbox.",
  );
  const latest = page.getByTestId("autopilot-latest");
  await expect(latest).toContainText(/^Week of .+: \d+ drafts waiting for you/);
  const drafted = Number(/(\d+) drafts/.exec((await latest.textContent()) ?? "")?.[1]);

  // Every draft waits in the Inbox with the reviewer's verdict; nothing was published.
  await page.goto("/app/inbox");
  for (const channel of ["Blog", "X", "LinkedIn"]) {
    await expect(inboxEntries(page, channel).first()).toBeVisible();
  }
  const entries = page.getByRole("list", { name: "Waiting for approval" }).getByRole("listitem");
  await expect(entries).toHaveCount(drafted);
  for (const entry of await entries.all()) {
    await expect(entry.getByTestId("agent-review")).toContainText(/^Reviewer: /);
  }
  await expect(inboxEntries(page, "Blog").first().getByTestId("agent-review")).toContainText(
    "Reviewer: passes",
  );

  // Approve and publish the first article to the WordPress blog.
  await inboxEntries(page, "Blog").first().getByRole("link", { name: "Open" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Waiting for your approval");
  await expect(page.getByTestId("agent-review")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish to blog" })).toBeDisabled();
  const title = `Autopilot article ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.getByRole("button", { name: "Approve article" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Approved");
  await page.getByRole("button", { name: "Publish to blog" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Published");
  const article = await page.getByRole("status").getByRole("link").getAttribute("href");
  expect(article).toBeTruthy();

  // Approve an X post from the Inbox and publish it through Zernio.
  await page.goto("/app/inbox");
  await inboxEntries(page, "X").first().getByRole("link", { name: "Open" }).click();
  await expect(page.getByLabel("X post")).toBeVisible();
  const postUrl = page.url();
  const text = `Five numbers a week, no cookies. ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("X post").fill(text);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.goto("/app/inbox");
  await page
    .getByRole("listitem")
    .filter({ hasText: text })
    .getByRole("button", { name: /^Approve/ })
    .click();
  await expect(page.getByRole("listitem").filter({ hasText: text })).toHaveCount(0);
  await page.goto(postUrl);
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Published");
  const posts = (await (await request.get(`${zernioStub()}/_stub/posts`)).json()) as StubPost[];
  expect(posts.filter((p) => p.content === text)).toHaveLength(1);

  // The article is live on the blog.
  await page.goto(article ?? "");
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
});
