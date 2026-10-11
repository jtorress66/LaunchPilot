import {
  domainError,
  err,
  isPaidPlan,
  ok,
  type PlanId,
  type Result,
  type User,
  type Workspace,
} from "@launchpilot/domain";
import type { CheckoutProvider } from "@launchpilot/ports";
import { failure, type UseCaseError } from "./errors";

export class StartCheckout {
  constructor(
    private readonly deps: { readonly checkout: CheckoutProvider; readonly appUrl: string },
  ) {}

  async execute(input: {
    user: User;
    workspace: Workspace;
    plan: PlanId;
  }): Promise<Result<{ url: string }, UseCaseError>> {
    if (!isPaidPlan(input.plan)) {
      return err(domainError("plan_not_purchasable", "Choose Starter or Growth to upgrade"));
    }
    const billing = `${this.deps.appUrl}/app/billing`;
    const result = await this.deps.checkout.createCheckout({
      workspaceId: input.workspace.id,
      plan: input.plan,
      email: input.user.email,
      successUrl: `${billing}?checkout=success`,
      cancelUrl: `${billing}?checkout=canceled`,
    });
    return result.ok
      ? ok(result.value)
      : err(failure("billing_failed", "Checkout is unavailable right now. Please try again."));
  }
}
