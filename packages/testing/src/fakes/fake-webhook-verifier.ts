import { err, ok, type BillingEvent, type Result } from "@launchpilot/domain";
import type { BillingError, BillingWebhookVerifier } from "@launchpilot/ports";

const IGNORED = "fake.ignored_event";

/** djb2 checksum: changes when any character changes. Not cryptographic; tests only. */
const checksum = (text: string): string => {
  let hash = 5381;
  for (const char of text) hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  return hash.toString(16);
};

const sign = (payload: string) => ({ payload, signature: `fake-signature:${checksum(payload)}` });

const reviveDates = (_key: string, value: unknown): unknown =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : value;

/** Accepts payloads signed by `FakeWebhookVerifier.sign`; the body is a JSON BillingEvent. */
export class FakeWebhookVerifier implements BillingWebhookVerifier {
  static sign(event: BillingEvent): { payload: string; signature: string } {
    return sign(JSON.stringify(event));
  }

  static signIgnored(): { payload: string; signature: string } {
    return sign(JSON.stringify({ type: IGNORED }));
  }

  verify(payload: string, signature: string): Promise<Result<BillingEvent | null, BillingError>> {
    if (signature !== sign(payload).signature) {
      return Promise.resolve(
        err({
          code: "invalid_signature",
          message: "Webhook signature is invalid",
          retryable: false,
        }),
      );
    }
    const event = JSON.parse(payload, reviveDates) as BillingEvent | { type: typeof IGNORED };
    return Promise.resolve(ok(event.type === IGNORED ? null : (event)));
  }
}
