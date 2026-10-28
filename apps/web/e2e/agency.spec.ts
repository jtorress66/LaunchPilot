import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  addClient,
  anAgency,
  buildClientReport,
  emailsTo,
  openClient,
  setBranding,
} from "./agency-helpers";
import { metricTile } from "./helpers";

// Build step 12 gate: an agency adds a client and sends a branded report.
test("an agency adds a client and emails the client's weekly report under its own brand", async ({
  page,
  request,
}, testInfo) => {
  await anAgency(page);
  await setBranding(page);
  await addClient(page, "Acme Corp");
  await openClient(page, "Acme Corp");
  await buildClientReport(page, testInfo.project.name);
  const visitors = /[\d,]+/.exec(await metricTile(page, "visitors").innerText())?.[0] ?? "";
  expect(visitors).not.toBe("");

  const client = `client+${randomUUID().slice(0, 8)}@acme.test`;
  await page.getByLabel("Send to").fill(client);
  await page.getByLabel("Email every new weekly report to these addresses").check();
  await page.getByRole("button", { name: "Email this report" }).click();
  await expect(page.getByRole("status")).toHaveText(`Sent to ${client}`);

  const emails = await emailsTo(request, client);
  expect(emails).toHaveLength(1);
  const [email] = emails;
  expect(email?.from).toBe('"Brightside Agency" <reports@mail.nuvantre.test>');
  expect(email?.reply_to).toBe("hello@brightside.agency");
  expect(email?.subject).toMatch(/^Acme Analytics — weekly report, \d{4}-W\d{2}$/);
  expect(email?.html).toContain("#0f766e");
  expect(email?.html).toContain(visitors);
  expect(email?.text).toContain(`Visitors: ${visitors}`);
  expect(`${email?.subject ?? ""}${email?.html ?? ""}${email?.text ?? ""}`).not.toMatch(
    /nuvantre/i,
  );

  // The agency's activity records the client; the client's records the email.
  await page.goto("/app/activity");
  await expect(page.getByRole("list", { name: "Activity" })).toContainText(
    "You emailed the report Acme Analytics",
  );
});
