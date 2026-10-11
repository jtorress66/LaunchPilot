import { expect, test, type Page } from "@playwright/test";
import { addProduct, signUp } from "../helpers";

/** Fills Stripe's hosted Checkout with its documented test card. */
const payWithTestCard = async (page: Page) => {
  const cardOption = page.getByTestId("card-accordion-item-button");
  await page.locator("#cardNumber").or(cardOption).first().waitFor();
  // When several payment methods are offered, Checkout shows them as an accordion.
  if (await cardOption.isVisible()) await cardOption.click();

  await page.locator("#cardNumber").fill("4242 4242 4242 4242");
  await page.locator("#cardExpiry").fill("12 / 34");
  await page.locator("#cardCvc").fill("123");
  await page.locator("#billingName").fill("Test Founder");
  const postalCode = page.locator("#billingPostalCode");
  if (await postalCode.isVisible()) await postalCode.fill("10001");
  await page.getByTestId("hosted-payment-submit-button").click();
};

// On failure, list the page's form controls in the job log, so a changed Checkout layout can be
// diagnosed without downloading the report.
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  const controls = await page.locator("input, select, button").evaluateAll((elements) =>
    elements.map((element) =>
      ["id", "name", "aria-label", "data-testid", "placeholder", "type"]
        .map((attribute) => {
          const value = element.getAttribute(attribute);
          return value ? `${attribute}=${value}` : "";
        })
        .filter(Boolean)
        .join(" "),
    ),
  );
  console.log(`Failed on ${page.url()}\nForm controls:\n${controls.join("\n")}`);
});

// Build step 4 gate, against real Stripe test mode: sign up → create product → buy a plan.
test("a founder buys the Starter plan on Stripe Checkout", async ({ page }) => {
  await signUp(page);
  await addProduct(page, "Acme Analytics", "https://acme.dev");
  await expect(page.getByRole("listitem").filter({ hasText: "Acme Analytics" })).toBeVisible();

  await page.goto("/app/billing");
  await page.getByRole("button", { name: "Upgrade to Starter" }).click();
  await page.waitForURL(/checkout\.stripe\.com/);
  await payWithTestCard(page);

  await page.waitForURL(/\/app\/billing\?checkout=success/, { timeout: 60_000 });
  // The plan changes when Stripe's webhook arrives through `stripe listen`.
  await expect(async () => {
    await page.goto("/app");
    await expect(page.getByTestId("plan-badge")).toHaveText("Starter plan", { timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
});
