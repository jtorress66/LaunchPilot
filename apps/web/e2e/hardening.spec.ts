import { expect, test, type Page } from "@playwright/test";
import { connectWordPress, onSeoPage, PASSWORD, signUp } from "./helpers";

// Build step 11 gate: rate limits, the Activity log, a strict CSP and the readiness check.

/** Collects every Content-Security-Policy violation the page reports. */
const watchCsp = async (page: Page) => {
  const violations: string[] = [];
  await page.exposeFunction("reportCspViolation", (text: string) => violations.push(text));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const report = (window as unknown as { reportCspViolation: (t: string) => void })
        .reportCspViolation;
      report(`${event.violatedDirective} blocked ${event.blockedURI}`);
    });
  });
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });
  return violations;
};

const logIn = async (page: Page, email: string, password: string) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
};

test("after ten failed logins the account waits, even for the right password", async ({ page }) => {
  const email = await signUp(page);
  await page.getByRole("button", { name: "Log out" }).click();

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    await logIn(page, email, "not the password at all");
    await expect(page.getByRole("main").getByRole("alert").first()).not.toContainText(
      "Too many attempts",
    );
  }
  await logIn(page, email, "not the password at all");
  await expect(page.getByRole("main")).toContainText("Too many attempts. Try again in");

  await logIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("main")).toContainText("Too many attempts");
});

test("a founder's approvals and publishing show on the Activity page, with no CSP violations", async ({
  page,
}) => {
  const violations = await watchCsp(page);
  await onSeoPage(page);
  await connectWordPress(page);
  await expect(page.getByRole("status")).toContainText("Connected to Nuvantre E2E Blog");

  await page.getByLabel("Topics your customers search for").fill("privacy analytics");
  await page.getByRole("button", { name: "Plan articles" }).click();
  await page
    .getByTestId("planned-article")
    .first()
    .getByRole("button", { name: "Draft article" })
    .click();
  await expect(page).toHaveURL(/\/app\/content\/[^/]+$/);
  const title = await page.getByLabel("Title").inputValue();
  await page.getByRole("button", { name: "Approve article" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Approved");
  await page.getByRole("button", { name: "Publish to blog" }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Published");

  await page
    .getByRole("navigation", { name: "App" })
    .getByRole("link", { name: "Activity" })
    .click();
  const activity = page.getByRole("list", { name: "Activity" });
  await expect(activity.getByRole("listitem").first()).toContainText(`You published “${title}”`);
  await expect(activity).toContainText(`You approved “${title}”`);
  await expect(activity).toContainText("You connected the blog Nuvantre E2E Blog");
  await expect(activity).toContainText("You approved the Product Brief for Acme Analytics");
  await expect(activity).toContainText("You added Acme Analytics");

  await activity.getByRole("link", { name: `You published “${title}”` }).click();
  await expect(page.getByTestId("content-status")).toHaveText("Published");

  expect(violations).toEqual([]);
});

test("every page carries a nonce-based CSP and a request id", async ({ request }) => {
  const response = await request.get("/");
  const csp = response.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(response.headers()["x-request-id"]).toBeTruthy();
});

test("GET /api/health/ready reports the database as ready", async ({ request }) => {
  const response = await request.get("/api/health/ready");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
});
