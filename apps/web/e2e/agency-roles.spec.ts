import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { addClient, anAgency, buildClientReport, emailsTo, openClient } from "./agency-helpers";
import { PASSWORD } from "./helpers";

test("a client viewer joins from the invitation and reads reports, but can change nothing", async ({
  page,
  browser,
  request,
}, testInfo) => {
  const owner = await anAgency(page);
  await addClient(page, "Acme Corp");
  await addClient(page, "Globex");
  await openClient(page, "Acme Corp");
  await buildClientReport(page, testInfo.project.name);
  const productPath = new URL(page.url()).pathname.replace(/\/analytics\/.*$/, "");

  const client = `viewer+${randomUUID().slice(0, 8)}@acme.test`;
  await page.getByRole("navigation", { name: "App" }).getByRole("link", { name: "Team" }).click();
  await page.getByLabel("Email").fill(client);
  await page.getByLabel("Role").selectOption("viewer");
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByRole("status")).toHaveText(`Invitation sent to ${client}`);
  const [invitation] = await emailsTo(request, client);
  const link = /https?:\/\/\S+\/invite\/[A-Za-z0-9_-]+/.exec(invitation?.text ?? "")?.[0];
  expect(link).toBeTruthy();

  // The client, in their own browser, signs up from the link and accepts.
  const context = await browser.newContext();
  const viewer = await context.newPage();
  await viewer.goto(link ?? "");
  await expect(viewer.getByRole("heading", { name: "Join Acme Corp" })).toBeVisible();
  await viewer.getByRole("link", { name: `Create an account with ${client}` }).click();
  await viewer.getByLabel("Email").fill(client);
  await viewer.getByLabel("Password").fill(PASSWORD);
  await viewer.getByRole("button", { name: "Create account" }).click();
  await expect(viewer).toHaveURL(/\/invite\//);
  await viewer.getByRole("button", { name: "Accept invitation" }).click();
  await expect(viewer).toHaveURL(/\/app$/);
  await expect(viewer.getByRole("heading", { name: "Acme Corp", level: 1 })).toBeVisible();

  // Reports and activity only: no inbox, billing or team.
  const nav = viewer.getByRole("navigation", { name: "App" });
  await expect(nav.getByRole("link")).toHaveText(["Dashboard", "Activity"]);
  const switcher = viewer.getByLabel("Workspace");
  await expect(switcher.locator("option")).toHaveText(["My workspace", "↳ Acme Corp"]);

  await viewer
    .getByRole("list", { name: "Reports" })
    .getByRole("link", { name: "Weekly reports" })
    .click();
  await expect(viewer.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();
  for (const control of ["Build report now", "Connect Plausible", "Approve", "Publish"]) {
    await expect(viewer.getByRole("button", { name: control })).toHaveCount(0);
  }
  await viewer.getByRole("link", { name: "Open this report" }).click();
  await expect(viewer.getByRole("heading", { name: /^Weekly report / })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Email this report" })).toHaveCount(0);

  // Work pages are closed to a viewer, even by address.
  await viewer.goto(`${productPath}/brief`);
  await expect(viewer).toHaveURL(/\/app\?denied=1$/);

  await viewer.goto("/app/activity");
  await expect(viewer.getByRole("list", { name: "Activity" })).toContainText(
    `${owner} added Acme Analytics`,
  );
  await context.close();
});
