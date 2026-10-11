import { err, ok, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";
import { plans, type PlanId } from "./plans";

const products = (n: number) => (n === 1 ? "1 product" : `${n} products`);

export const checkCanCreateProduct = (
  plan: PlanId,
  existingCount: number,
): Result<null, DomainError> => {
  const { name, limits } = plans[plan];
  return existingCount < limits.products
    ? ok(null)
    : err(
        domainError(
          "plan_limit_reached",
          `The ${name} plan includes ${products(limits.products)}. Upgrade to add more.`,
        ),
      );
};
