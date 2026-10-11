import { err, ok, type Result } from "@launchpilot/domain";
import type { BillingError, CheckoutProvider, CheckoutRequest } from "@launchpilot/ports";
import { NextFailure } from "./next-failure";

export class FakeCheckoutProvider implements CheckoutProvider {
  readonly requests: CheckoutRequest[] = [];
  private readonly failure = new NextFailure<BillingError>();

  failNext(error: BillingError): void {
    this.failure.set(error);
  }

  createCheckout(request: CheckoutRequest): Promise<Result<{ url: string }, BillingError>> {
    this.requests.push(request);
    const error = this.failure.take();
    return Promise.resolve(
      error
        ? err(error)
        : ok({ url: `https://checkout.test/${request.workspaceId}/${request.plan}` }),
    );
  }
}
