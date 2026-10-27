import { expect, test, type Page } from "@playwright/test";
import { addProduct, draftBrief, FIXTURE_SITE, signUp } from "./helpers";

const buyGrowth = async (page: Page) => {
  await page.goto("/app/billing");
  await page.getByRole("button", { name: "Upgrade to Growth" }).click();
  await page.getByRole("button", { name: "Pay $79 (test)" }).click();
  await expect(page.getByText("You are on the Growth plan")).toBeVisible();
};

/** Adds a product from the dashboard and returns its id, from the brief page it opens. */
const add = async (page: Page, name: string, url = FIXTURE_SITE) => {
  await page.goto("/app");
  await addProduct(page, name, url);
  await expect(page).toHaveURL(/\/app\/products\/[^/]+\/brief$/);
  return page.url().split("/").at(-2) ?? "";
};

const approveBrief = async (page: Page) => {
  await draftBrief(page);
  await page.getByRole("button", { name: "Approve brief" }).click();
  await expect(page.getByTestId("brief-status")).toHaveText("Approved");
};

const card = (page: Page, name: string) =>
  page.getByTestId("product-card").filter({ has: page.getByRole("link", { name, exact: true }) });

const switcher = (page: Page) => page.getByLabel("Product", { exact: true });

// Build step 10.7 gate: a founder on Growth manages 3 products and switches between them.
test("a founder on Growth manages three products and switches between them", async ({ page }) => {
  await signUp(page);
  await buyGrowth(page);
  const alpha = await add(page, "Alpha");
  await approveBrief(page);
  const beta = await add(page, "Beta");
  await approveBrief(page);
  const gamma = await add(page, "Gamma");

  // The dashboard shows each product's state at a glance.
  await page.goto("/app");
  await expect(page.getByTestId("product-card")).toHaveCount(3);
  await expect(page.getByRole("meter", { name: "Products" })).toHaveAttribute("aria-valuenow", "3");
  await expect(card(page, "Alpha")).toContainText("Brief approved");
  await expect(card(page, "Gamma")).toContainText("Brief not drafted");
  for (const name of ["Alpha", "Beta", "Gamma"]) {
    await expect(card(page, name).getByTestId("product-standing")).toHaveText("Active");
  }

  // The switcher keeps the section: Alpha's SEO page → Beta's SEO page → Gamma's.
  await page.goto(`/app/products/${alpha}/seo`);
  await expect(switcher(page)).toHaveValue(alpha);
  await switcher(page).selectOption({ label: "Beta" });
  await expect(page).toHaveURL(new RegExp(`/app/products/${beta}/seo$`));
  await expect(page.getByRole("heading", { name: "SEO", exact: true })).toBeVisible();
  await expect(switcher(page)).toHaveValue(beta);
  await switcher(page).selectOption({ label: "Gamma" });
  await expect(page).toHaveURL(new RegExp(`/app/products/${gamma}/seo$`));

  // The section tabs move within a product.
  await page
    .getByRole("navigation", { name: "Product sections" })
    .getByRole("link", { name: "Brief" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/app/products/${gamma}/brief$`));
  await expect(
    page.getByRole("navigation", { name: "Product sections" }).getByRole("link", { name: "Brief" }),
  ).toHaveAttribute("aria-current", "page");

  // A fourth product does not fit the plan.
  await page.goto("/app");
  await addProduct(page, "Delta", "https://delta.dev");
  await expect(
    page.getByRole("alert").filter({ hasText: "The Growth plan includes 3 products" }),
  ).toContainText("Upgrade or archive one to add more.");
});

test("archiving frees a slot, and restoring needs one", async ({ page }) => {
  await signUp(page);
  await buyGrowth(page);
  for (const name of ["Alpha", "Beta", "Gamma"])
    await add(page, name, `https://${name.toLowerCase()}.dev`);

  await page.goto("/app");
  await card(page, "Gamma").getByRole("button", { name: "Archive Gamma" }).click();
  await expect(page.getByTestId("archived-product")).toHaveText(/Gamma/);
  await expect(page.getByTestId("product-card")).toHaveCount(2);
  await expect(page.getByRole("meter", { name: "Products" })).toHaveAttribute("aria-valuenow", "2");

  await add(page, "Delta", "https://delta.dev");
  await page.goto("/app");
  await page.getByRole("button", { name: "Restore Gamma" }).click();
  await expect(page.getByTestId("archived-product").getByRole("alert")).toHaveText(
    "The Growth plan includes 3 products, all in use. Upgrade, or archive another product first.",
  );

  await card(page, "Delta").getByRole("button", { name: "Archive Delta" }).click();
  await expect(page.getByTestId("archived-product").filter({ hasText: "Delta" })).toBeVisible();
  await page.getByRole("button", { name: "Restore Gamma" }).click();
  await expect(card(page, "Gamma").getByTestId("product-standing")).toHaveText("Active");
  await expect(page.getByTestId("archived-product")).toHaveCount(1);
});

test("after a downgrade the newer products pause, and the founder chooses which stays active", async ({
  page,
}) => {
  await signUp(page);
  await buyGrowth(page);
  await add(page, "Alpha", "https://alpha.dev");
  const beta = await add(page, "Beta");
  await add(page, "Gamma", "https://gamma.dev");

  await page.goto("/app/billing");
  await page.getByRole("button", { name: "Cancel plan (test)" }).click();
  await expect(page.getByText("You are on the Free plan")).toBeVisible();

  await page.goto("/app");
  await expect(card(page, "Alpha").getByTestId("product-standing")).toHaveText("Active");
  await expect(card(page, "Beta").getByTestId("product-standing")).toHaveText("Paused");
  await expect(card(page, "Gamma").getByTestId("product-standing")).toHaveText("Paused");

  // A paused product can be opened, but nothing is drafted for it.
  await page.goto(`/app/products/${beta}/brief`);
  const banner = page.getByTestId("paused-banner");
  await expect(banner).toContainText("Beta is paused.");
  await page.getByRole("button", { name: /Draft my brief/ }).click();
  await expect(page.getByRole("main").getByRole("alert").first()).toContainText(
    "Beta is paused: the Free plan includes 1 product.",
  );

  // Make Beta active in Alpha's place.
  await banner.getByLabel("Pause instead").selectOption({ label: "Alpha" });
  await banner.getByRole("button", { name: "Make Beta active" }).click();
  await expect(page.getByTestId("paused-banner")).toHaveCount(0);
  await expect(switcher(page).locator("option", { hasText: "Alpha (paused)" })).toHaveCount(1);
  await page.goto("/app");
  await expect(card(page, "Beta").getByTestId("product-standing")).toHaveText("Active");
  await expect(card(page, "Alpha").getByTestId("product-standing")).toHaveText("Paused");
});
