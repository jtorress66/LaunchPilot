import { parseEmail, type Email } from "@nuvantre/domain";
import type { EmailMessage, Mailer } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";

/** What the provider received, as the contract checks it. */
export interface DeliveredEmail {
  readonly to: readonly string[];
  readonly fromName: string;
  readonly replyTo: string | undefined;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export interface MailerHarness {
  readonly mailer: Mailer;
  readonly delivered: () => Promise<readonly DeliveredEmail[]> | readonly DeliveredEmail[];
  /** Makes the provider refuse the next message (for example an unverified sender). */
  readonly rejectNext: () => void;
}

const email = (value: string): Email => {
  const parsed = parseEmail(value);
  if (!parsed.ok) throw new Error(value);
  return parsed.value;
};

const message = (overrides: Partial<EmailMessage> = {}): EmailMessage => ({
  to: [email("client@acme.test")],
  fromName: "Brightside Agency",
  replyTo: email("hello@brightside.agency"),
  subject: "Acme Analytics — weekly report",
  html: "<p>Visitors: 1,240</p>",
  text: "Visitors: 1,240",
  idempotencyKey: "report-1:client@acme.test:2026-10-27",
  ...overrides,
});

export function describeMailerContract(
  name: string,
  make: () => MailerHarness | Promise<MailerHarness>,
): void {
  describe(`Mailer contract: ${name}`, () => {
    it("sends a message as the given sender name and returns the provider's id", async () => {
      const harness = await make();
      const sent = await harness.mailer.send(message());
      const id = sent.ok ? sent.value.id : "";
      expect(id).toMatch(/\S/);
      expect(await harness.delivered()).toEqual([
        {
          to: ["client@acme.test"],
          fromName: "Brightside Agency",
          replyTo: "hello@brightside.agency",
          subject: "Acme Analytics — weekly report",
          html: "<p>Visitors: 1,240</p>",
          text: "Visitors: 1,240",
        },
      ]);
    });

    it("sends a message only once for the same idempotency key", async () => {
      const harness = await make();
      const first = await harness.mailer.send(message());
      const again = await harness.mailer.send(message());
      expect(again).toEqual(first);
      expect(await harness.delivered()).toHaveLength(1);
    });

    it("returns a refusal as a result the caller can show, without throwing", async () => {
      const harness = await make();
      harness.rejectNext();
      const sent = await harness.mailer.send(message({ idempotencyKey: "other" }));
      expect(sent).toMatchObject({
        ok: false,
        error: { code: "mailer_rejected", retryable: false },
      });
      expect(await harness.delivered()).toEqual([]);
    });
  });
}
