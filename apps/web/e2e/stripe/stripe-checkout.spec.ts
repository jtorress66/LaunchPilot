import { expect, test } from "@playwright/test";
import { addProduct, signUp } from "../helpers";

// Build step 4 gate, against real Stripe test mode: sign up → create product → buy a plan.
test("a founder buys the Starter plan on Stripe Checkout", async ({ page }) => {
  await signUp(page);
  await addProduct(page, "Acme Analytics", "https://acme.dev");
  await expect(page.getByRole("listitem").filter({ hasText: "Acme Analytics" })).toBeVisible();

  await page.goto("/app/billing");
  await page.getByRole("button", { name: "Upgrade to Starter" }).click();
  await page.waitForURL(/checkout\.stripe\.com/);

  // Stripe's hosted page, using its documented test card.
  await page.getByLabel("Card number").fill("4242 4242 4242 4242");
  await page.getByLabel("Expiration").fill("12 / 34");
  await page.getByLabel("CVC").fill("123");
  await page.getByLabel("Cardholder name").fill("Test Founder");
  const zip = page.getByLabel("ZIP");
  if (await zip.isVisible()) await zip.fill("10001");
  await page.getByTestId("hosted-payment-submit-button").click();

  await page.waitForURL(/\/app\/billing\?checkout=success/, { timeout: 60_000 });
  // The plan changes when Stripe's webhook arrives through `stripe listen`.
  await expect(async () => {
    await page.goto("/app");
    await expect(page.getByTestId("plan-badge")).toHaveText("Starter plan", { timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
});
