import type { Result } from "@nuvantre/domain";
import { clientAddress, type RateGuard } from "./rate-limit";

export interface WebhookHandlerDeps {
  readonly signatureHeader: string;
  readonly trustProxy: boolean;
  readonly rateGuard: RateGuard;
  readonly handle: (input: {
    payload: string;
    signature: string;
  }) => Promise<Result<{ handled: boolean }, { code: string; message: string }>>;
}

/** Billing provider webhooks: raw body + signature header in; 200, 400 or 429 out. */
export const createWebhookHandler =
  ({ signatureHeader, trustProxy, rateGuard, handle }: WebhookHandlerDeps) =>
  async (request: Request): Promise<Response> => {
    const decision = await rateGuard("webhook", clientAddress(request.headers, trustProxy));
    if (!decision.allowed) {
      return Response.json(
        { error: "rate_limited" },
        { status: 429, headers: { "retry-after": String(decision.retryAfterSeconds) } },
      );
    }
    const result = await handle({
      payload: await request.text(),
      signature: request.headers.get(signatureHeader) ?? "",
    });
    return result.ok
      ? Response.json({ received: true, handled: result.value.handled })
      : Response.json({ error: result.error.code }, { status: 400 });
  };
