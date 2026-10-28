import { parseEmail, type Email } from "@nuvantre/domain";
import { describe, expect, it } from "vitest";
import { LogMailer } from "./log-mailer";

const email = (value: string): Email => {
  const parsed = parseEmail(value);
  if (!parsed.ok) throw new Error(value);
  return parsed.value;
};

describe("LogMailer", () => {
  it("logs that an email would be sent, with only the subject and the recipients' domains", async () => {
    const lines: string[] = [];
    const mailer = new LogMailer((line) => lines.push(line));
    const result = await mailer.send({
      to: [email("client@acme.test"), email("boss@globex.test")],
      fromName: "Brightside Agency",
      subject: "Weekly report",
      html: "<p>secret numbers</p>",
      text: "secret numbers",
      idempotencyKey: "k1",
    });
    expect(result).toEqual({ ok: true, value: { id: "logged-k1" } });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toEqual({
      event: "mail.logged",
      subject: "Weekly report",
      recipientDomains: ["acme.test", "globex.test"],
    });
    expect(lines[0]).not.toContain("client@");
    expect(lines[0]).not.toContain("secret numbers");
  });
});
