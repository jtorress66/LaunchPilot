import { getAppContainer } from "../../../../container";

export const dynamic = "force-dynamic";

/** Billing provider webhooks: raw body + signature header in, 200 or 400 out. */
export async function POST(request: Request): Promise<Response> {
  const app = getAppContainer();
  const result = await app.handleBillingWebhook.execute({
    payload: await request.text(),
    signature: request.headers.get(app.webhookSignatureHeader) ?? "",
  });
  return result.ok
    ? Response.json({ received: true, handled: result.value.handled })
    : Response.json({ error: result.error.code }, { status: 400 });
}
