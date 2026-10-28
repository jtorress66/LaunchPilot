import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { addProduct, connectPlausible, FIXTURE_SITE, signUp } from "./helpers";

/** The local Resend stand-in started by scripts/e2e.mjs. */
export const resendStub = () => {
  const url = process.env.E2E_RESEND_URL;
  if (!url) throw new Error("E2E_RESEND_URL is not set: run `pnpm test:e2e`");
  return url;
};

export interface SentEmail {
  readonly from: string;
  readonly to: readonly string[];
  readonly reply_to?: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/** Every email the stand-in received for this address. */
export const emailsTo = async (request: APIRequestContext, address: string) => {
  const all = (await (await request.get(`${resendStub()}/_stub/emails`)).json()) as SentEmail[];
  return all.filter((email) => email.to.includes(address));
};

const appNav = (page: Page) => page.getByRole("navigation", { name: "App" });

/** Signs up and pays for the Agency plan in test mode. */
export const anAgency = async (page: Page) => {
  const email = await signUp(page);
  await appNav(page).getByRole("link", { name: "Billing" }).click();
  await page.getByRole("button", { name: "Upgrade to Agency" }).click();
  await page.getByRole("button", { name: "Pay $199 (test)" }).click();
  await expect(page.getByRole("status")).toContainText("Payment received");
  return email;
};

export const setBranding = async (page: Page) => {
  await appNav(page).getByRole("link", { name: "Branding" }).click();
  await page.getByLabel("Sender name").fill("Brightside Agency");
  await page.getByLabel("Accent colour").fill("#0f766e");
  await page.getByLabel("Reply-to address").fill("hello@brightside.agency");
  await page.getByRole("button", { name: "Save branding" }).click();
  await expect(page.getByRole("status")).toHaveText("Branding saved");
};

export const addClient = async (page: Page, name: string) => {
  await appNav(page).getByRole("link", { name: "Clients" }).click();
  await page.getByLabel("Client name").fill(name);
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page.getByRole("status")).toHaveText(`Added ${name}`);
};

export const openClient = async (page: Page, name: string) => {
  await appNav(page).getByRole("link", { name: "Clients" }).click();
  await page.getByRole("button", { name: `Open ${name}` }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("banner")).toContainText(name);
};

/** Adds the fixture product in the open workspace, connects Plausible and builds a report. */
export const buildClientReport = async (page: Page, project: string) => {
  await addProduct(page, "Acme Analytics", FIXTURE_SITE);
  await expect(page).toHaveURL(/\/app\/products\/[^/]+\/brief$/);
  await page.goto(page.url().replace(/\/brief$/, "/analytics"));
  await connectPlausible(page, project);
  await page.getByRole("button", { name: "Build report now" }).click();
  await expect(page).toHaveURL(/\/analytics\/\d{4}-W\d{2}$/);
};
