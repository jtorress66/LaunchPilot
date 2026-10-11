import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("shows the LaunchPilot headline and a primary call to action", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/LaunchPilot/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("marketing team");
    await expect(page.getByRole("link", { name: "Start free" }).first()).toBeVisible();
  });

  test("promises founder approval before anything is published", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Nothing goes live without your approval").first()).toBeVisible();
  });

  test("renders without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });

  test("has no horizontal scroll on a phone-sized viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
