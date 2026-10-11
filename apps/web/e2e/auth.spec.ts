import { expect, test } from "@playwright/test";
import { PASSWORD, signUp, uniqueEmail } from "./helpers";

test("a founder can log out and log back in", async ({ page }) => {
  const email = await signUp(page);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email.toUpperCase());
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("a wrong password shows an error without saying whether the account exists", async ({
  page,
}) => {
  const email = await signUp(page);
  await page.getByRole("button", { name: "Log out" }).click();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not the right password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Email or password is incorrect",
  );
});

test("signing up twice with the same email is refused", async ({ page }) => {
  const email = await signUp(page);
  await page.getByRole("button", { name: "Log out" }).click();
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "An account with this email already exists",
  );
});

test("a weak password is explained next to the field", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Use at least 10 characters");
});

test("the app is only reachable when logged in", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  await page
    .context()
    .addCookies([{ name: "lp_session", value: "forged", url: "http://localhost:3000" }]);
  await page.goto("/app/billing");
  await expect(page).toHaveURL(/\/login\?expired=1$/);
});
