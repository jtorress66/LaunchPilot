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
