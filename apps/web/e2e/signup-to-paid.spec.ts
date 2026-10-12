import { expect, test } from "@playwright/test";
import { addProduct, signUp } from "./helpers";

// Build step 4 gate: sign up → create product → buy a plan.
test("a founder signs up, adds a product, hits the Free limit and upgrades to Starter", async ({
  page,
}) => {
  await signUp(page);
  await expect(page.getByTestId("plan-badge")).toHaveText("Free plan");

  await addProduct(page, "Acme Analytics", "https://acme.dev");
  // A new product opens its brief page so the founder can draft the brief straight away.
  await expect(page).toHaveURL(/\/app\/products\/[^/]+\/brief$/);
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Acme Analytics" })).toBeVisible();
  await expect(page.getByRole("meter", { name: "Products" })).toHaveAttribute("aria-valuenow", "1");

  await addProduct(page, "Second Product", "https://second.dev");
  const limit = page.getByRole("alert").filter({ hasText: "The Free plan includes 1 product" });
  await expect(limit).toBeVisible();

  await limit.getByRole("link", { name: "See plans" }).click();
  await expect(page).toHaveURL(/\/app\/billing$/);
  await page.getByRole("button", { name: "Upgrade to Starter" }).click();

  await expect(page.getByText("Test mode: no real payment is taken")).toBeVisible();
  await page.getByRole("button", { name: "Pay $29 (test)" }).click();

  await expect(page.getByRole("status")).toContainText("Payment received");
  await expect(page.getByText("You are on the Starter plan")).toBeVisible();
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByTestId("plan-badge")).toHaveText("Starter plan");
});

test("a founder can cancel the checkout without being charged", async ({ page }) => {
  await signUp(page);
  await page.goto("/app/billing");
  await page.getByRole("button", { name: "Upgrade to Growth" }).click();
  await page.getByRole("link", { name: "Cancel and go back" }).click();
  await expect(page.getByRole("status")).toContainText("You have not been charged");
  await expect(page.getByText("You are on the Free plan")).toBeVisible();
});
