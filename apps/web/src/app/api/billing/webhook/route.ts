import { getAppContainer } from "../../../../container";
import { createWebhookHandler } from "../../../../server/webhook-handler";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const app = getAppContainer();
  return createWebhookHandler({
    signatureHeader: app.webhookSignatureHeader,
    trustProxy: app.trustProxy,
    rateGuard: app.rateGuard,
    handle: (input) => app.handleBillingWebhook.execute(input),
  })(request);
}
