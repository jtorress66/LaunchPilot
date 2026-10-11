import { expect, test, type Locator, type Page } from "@playwright/test";
import { addProduct, signUp } from "../helpers";

/**
 * Stripe Checkout renders card inputs inside embedded Stripe frames, so each field is searched for
 * in every frame, by its standard autofill attribute first (stable across layouts), then by the
 * ids older Checkout layouts used.
 */
const cardFields = [
  {
    name: "card number",
    value: "4242424242424242",
    required: true,
    selectors: [
      'input[autocomplete="cc-number"]',
      "#cardNumber",
      'input[name="number"]',
      'input[name="cardnumber"]',
    ],
  },
  {
    name: "expiry",
    value: "1234",
    required: true,
    selectors: [
      'input[autocomplete="cc-exp"]',
      "#cardExpiry",
      'input[name="expiry"]',
      'input[name="exp-date"]',
    ],
  },
  {
    name: "CVC",
    value: "123",
    required: true,
    selectors: ['input[autocomplete="cc-csc"]', "#cardCvc", 'input[name="cvc"]'],
  },
  {
    name: "cardholder name",
    value: "Test Founder",
    required: false,
    selectors: ['input[autocomplete="cc-name"]', "#billingName", 'input[name="billingName"]'],
  },
  {
    name: "postal code",
    value: "10001",
    required: false,
    selectors: [
      'input[autocomplete="postal-code"]',
      "#billingPostalCode",
      'input[name="postalCode"]',
    ],
  },
] as const;

const findInFrames = async (
  page: Page,
  selectors: readonly string[],
): Promise<Locator | undefined> => {
  for (const frame of page.frames()) {
    for (const selector of selectors) {
      const candidate = frame.locator(selector).first();
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
  }
  return undefined;
};

/** Pays on Stripe's hosted Checkout with its documented test card. */
const payWithTestCard = async (page: Page) => {
  // With several payment methods, Checkout shows an accordion; open Card unless it already is.
  const cardOption = page.getByTestId("card-accordion-item-button");
  if (await cardOption.isVisible().catch(() => false)) await cardOption.click();

  for (const field of cardFields) {
    let input: Locator | undefined;
    if (field.required) {
      await expect
        .poll(async () => (input = await findInFrames(page, field.selectors)) !== undefined, {
          message: `Stripe Checkout ${field.name} field`,
          timeout: 30_000,
        })
        .toBe(true);
    } else {
      input = await findInFrames(page, field.selectors);
    }
    await input?.pressSequentially(field.value, { delay: 30 });
  }
  await page.getByTestId("hosted-payment-submit-button").click();
};

// On failure, list every frame's form controls in the job log, so a changed Checkout layout can be
// diagnosed without downloading the report.
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  const lines: string[] = [`Failed on ${page.url()}`];
  for (const frame of page.frames()) {
    const controls = await frame
      .locator("input, select, button")
      .evaluateAll((elements) =>
        elements.map((element) =>
          ["id", "name", "autocomplete", "aria-label", "data-testid", "placeholder", "type"]
            .map((attribute) => {
              const value = element.getAttribute(attribute);
              return value ? `${attribute}=${value}` : "";
            })
            .filter(Boolean)
            .join(" "),
        ),
      )
      .catch(() => ["(frame not readable)"]);
    lines.push(
      `Frame ${frame.name() || "(main)"} ${frame.url().slice(0, 80)}`,
      ...controls.map((c) => `  ${c}`),
    );
  }
  console.log(lines.join("\n"));
});

// Build step 4 gate, against real Stripe test mode: sign up → create product → buy a plan.
test("a founder buys the Starter plan on Stripe Checkout", async ({ page }) => {
  await signUp(page);
  await addProduct(page, "Acme Analytics", "https://acme.dev");
  await expect(page.getByRole("listitem").filter({ hasText: "Acme Analytics" })).toBeVisible();

  await page.goto("/app/billing");
  await page.getByRole("button", { name: "Upgrade to Starter" }).click();
  await page.waitForURL(/checkout\.stripe\.com/);
  await page.getByTestId("hosted-payment-submit-button").waitFor();
  await payWithTestCard(page);

  await page.waitForURL(/\/app\/billing\?checkout=success/, { timeout: 60_000 });
  // The plan changes when Stripe's webhook arrives through `stripe listen`.
  await expect(async () => {
    await page.goto("/app");
    await expect(page.getByTestId("plan-badge")).toHaveText("Starter plan", { timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
});
