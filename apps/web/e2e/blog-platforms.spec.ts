import { expect, test, type Page } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";
import { onSeoPage } from "./helpers";

const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error("Run E2E through `pnpm test:e2e`");
  return value;
};

/** Chooses the platform and fills its fields, by the labels the founder sees. */
const connect = async (page: Page, platform: string, fields: Record<string, string>) => {
  await page.getByLabel("Platform", { exact: true }).selectOption(platform);
  for (const [label, value] of Object.entries(fields)) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByRole("button", { name: /Connect blog|Reconnect blog/ }).click();
};

/** Plans, drafts, sets the slug and excerpt, approves and publishes; returns the post's address. */
const publishArticle = async (page: Page, slug: string, excerpt: string) => {
  await page.getByLabel("Topics your customers search for").fill("privacy analytics");
  await page.getByRole("button", { name: "Plan articles" }).click();
  const planned = page.getByTestId("planned-article");
  await expect(planned.first()).toContainText("searches/month");
  await planned.first().getByRole("button", { name: "Draft article" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Waiting for your approval");
  await expect(page.getByRole("button", { name: "Publish to blog" })).toBeDisabled();

  await page.getByLabel("URL slug").fill(slug);
  await page.getByLabel("Excerpt").fill(excerpt);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  const title = await page.getByLabel("Title").inputValue();
  await page.getByRole("button", { name: "Approve article" }).click();
  await page.getByRole("button", { name: "Publish to blog" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Published");
  return {
    title,
    href: (await page.getByRole("status").getByRole("link").getAttribute("href")) ?? "",
  };
};

const excerpt = "How SaaS founders measure what matters without cookie banners.";
const uniqueSlug = (platform: string) => `${platform}-analytics-${randomUUID().slice(0, 8)}`;

/** A short-lived Admin API token, to read the post back from the real Ghost. */
const ghostToken = (adminKey: string) => {
  const [id = "", secret = ""] = adminKey.split(":");
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = `${part({ alg: "HS256", typ: "JWT", kid: id })}.${part({ iat, exp: iat + 300, aud: "/admin/" })}`;
  const signature = createHmac("sha256", Buffer.from(secret, "hex"))
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
};

interface GhostPost {
  readonly slug: string;
  readonly status: string;
  readonly custom_excerpt: string | null;
  readonly html: string;
}

// Build step 10.6 gate: an approved article goes live on a real Ghost blog.
test("a founder connects a Ghost blog and publishes an approved article to it", async ({
  page,
  request,
}) => {
  const url = env("E2E_GHOST_URL");
  const adminKey = env("E2E_GHOST_ADMIN_KEY");
  await onSeoPage(page);
  await connect(page, "Ghost", { "Blog address": url, "Admin API key": adminKey });
  await expect(page.getByRole("status")).toContainText("Connected to Nuvantre E2E Ghost on Ghost");

  const slug = uniqueSlug("ghost");
  const { title, href } = await publishArticle(page, slug, excerpt);
  expect(href).toBe(`${url}${slug}/`);

  // Ghost has the post, live, with the slug, excerpt and the article's facts.
  const response = await request.get(`${url}ghost/api/admin/posts/slug/${slug}/?formats=html`, {
    headers: { authorization: `Ghost ${ghostToken(adminKey)}`, "accept-version": "v5.0" },
  });
  const [post] = ((await response.json()) as { posts: GhostPost[] }).posts;
  expect(post).toMatchObject({ slug, status: "published", custom_excerpt: excerpt });
  expect(post?.html).toMatch(/free 14-day trial/i);

  await page.goto(href);
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
});

test("a wrong Ghost key is refused with Ghost's reason and never shown back", async ({ page }) => {
  const [id = ""] = env("E2E_GHOST_ADMIN_KEY").split(":");
  const wrong = `${id}:${"0".repeat(64)}`;
  await onSeoPage(page);
  await connect(page, "Ghost", { "Blog address": env("E2E_GHOST_URL"), "Admin API key": wrong });
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Ghost did not accept that Admin API key",
  );
  await expect(page.getByText(wrong)).toHaveCount(0);
  // The form stays on Ghost, so trying again sends Ghost's fields as Ghost.
  await expect(page.getByLabel("Platform", { exact: true })).toHaveValue("ghost");
  await expect(page.getByLabel("Admin API key", { exact: true })).toBeVisible();
});

interface StubRequest {
  readonly platform: string;
  readonly method: string;
  readonly body: Record<string, unknown>;
}

const stubbed = () => {
  const base = env("E2E_BLOGS_URL");
  return [
    {
      platform: "Shopify",
      fields: {
        "Store address (your-store.myshopify.com)": base,
        "Admin API access token": env("E2E_SHOPIFY_TOKEN"),
      },
      connected: "Connected to Acme Store on Shopify",
      postUrl: (slug: string) => `${base}/shop/blogs/news/${slug}`,
      sent: (request: StubRequest) =>
        (request.body.variables as { article?: Record<string, unknown> } | undefined)?.article,
      expected: (slug: string, title: string) => ({
        handle: slug,
        summary: excerpt,
        title,
        isPublished: true,
      }),
    },
    {
      platform: "Webflow",
      fields: {
        "Site address": `${base}/webflow-site/`,
        "Webflow collection ID": env("E2E_WEBFLOW_COLLECTION"),
        "Site API token": env("E2E_WEBFLOW_TOKEN"),
      },
      connected: "Connected to 127.0.0.1 on Webflow",
      postUrl: (slug: string) => `${base}/webflow-site/post/${slug}`,
      sent: (request: StubRequest) => request.body.fieldData as Record<string, unknown> | undefined,
      expected: (slug: string, title: string) => ({ slug, name: title, "post-summary": excerpt }),
    },
    {
      platform: "Wix",
      fields: {
        "Site address": `${base}/wix-site/`,
        "Wix site ID": env("E2E_WIX_SITE_ID"),
        "API key": env("E2E_WIX_KEY"),
      },
      connected: "Connected to 127.0.0.1 on Wix",
      postUrl: (slug: string) => `${base}/wix-site/post/${slug}`,
      sent: (request: StubRequest) => request.body.draftPost as Record<string, unknown> | undefined,
      expected: (slug: string, title: string) => ({ seoSlug: slug, excerpt, title }),
    },
  ];
};

for (const name of ["Shopify", "Webflow", "Wix"]) {
  // Build step 10.6 gate: the same journey against a local stand-in for the platform's API.
  test(`a founder connects a ${name} blog and publishes an approved article to it`, async ({
    page,
    request,
  }) => {
    const platform = stubbed().find((p) => p.platform === name);
    if (!platform) throw new Error(`No stub for ${name}`);
    await onSeoPage(page);
    await connect(page, name, platform.fields);
    await expect(page.getByRole("status")).toContainText(platform.connected);

    const slug = uniqueSlug(name.toLowerCase());
    const { title, href } = await publishArticle(page, slug, excerpt);
    expect(href).toBe(platform.postUrl(slug));

    // The platform received the approved article with its slug and excerpt.
    const received = (await (
      await request.get(`${env("E2E_BLOGS_URL")}/_stub/requests`)
    ).json()) as StubRequest[];
    const sent = received
      .filter((r) => r.platform === name.toLowerCase() && r.method === "POST")
      .map(platform.sent)
      .find((body) => body !== undefined && JSON.stringify(body).includes(slug));
    expect(sent).toMatchObject(platform.expected(slug, title));

    await page.goto(href);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  });
}
