import type { Plan } from "../billing/plans";
import { err, ok, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";
import type { ProductId } from "../shared/ids";
import type { Product } from "./product";

/** Which of a workspace's products may work under its plan; derived on every read, never stored. */
export interface SlotAllocation {
  readonly active: readonly Product[];
  /** Over the plan's limit: readable and editable, but nothing is drafted or published. */
  readonly paused: readonly Product[];
  readonly archived: readonly Product[];
}

export type ProductStanding = "active" | "paused" | "archived";

const products = (n: number) => (n === 1 ? "1 product" : `${String(n)} products`);

const bySlotOrder = (x: Product, y: Product) =>
  x.slotOrder.getTime() - y.slotOrder.getTime() || x.id.localeCompare(y.id);

export const slotsInUse = (all: readonly Product[]): number =>
  all.filter((p) => p.archivedAt === null).length;

/** The non-archived products fill the plan's slots in slot order (oldest first by default). */
export const allocateSlots = (all: readonly Product[], plan: Plan): SlotAllocation => {
  const live = all.filter((p) => p.archivedAt === null).sort(bySlotOrder);
  return {
    active: live.slice(0, plan.limits.products),
    paused: live.slice(plan.limits.products),
    archived: all.filter((p) => p.archivedAt !== null),
  };
};

export const standingOf = (
  id: ProductId,
  allocation: SlotAllocation,
): ProductStanding | undefined => {
  const has = (list: readonly Product[]) => list.some((p) => p.id === id);
  if (has(allocation.active)) return "active";
  if (has(allocation.paused)) return "paused";
  return has(allocation.archived) ? "archived" : undefined;
};

/** Drafting, publishing and the weekly jobs run only for active products. */
export const checkProductActive = (
  product: Product,
  allocation: SlotAllocation,
  plan: Plan,
): Result<null, DomainError> => {
  const standing = standingOf(product.id, allocation);
  if (standing === "archived") {
    return err(
      domainError(
        "product_archived",
        `${product.name} is archived. Restore it to work on it again.`,
      ),
    );
  }
  if (standing === "paused") {
    return err(
      domainError(
        "product_paused",
        `${product.name} is paused: the ${plan.name} plan includes ${products(plan.limits.products)}. Upgrade, or archive or pause another product.`,
      ),
    );
  }
  return ok(null);
};

export const archiveProduct = (product: Product, now: Date): Product => ({
  ...product,
  archivedAt: now,
});

/** Back into the slots, after the others, when the plan has a free one. */
export const restoreProduct = (
  product: Product,
  allocation: SlotAllocation,
  plan: Plan,
  now: Date,
): Result<Product, DomainError> => {
  if (product.archivedAt === null) return ok(product);
  if (allocation.active.length + allocation.paused.length >= plan.limits.products) {
    return err(
      domainError(
        "no_free_slot",
        `The ${plan.name} plan includes ${products(plan.limits.products)}, all in use. Upgrade, or archive another product first.`,
      ),
    );
  }
  return ok({ ...product, archivedAt: null, slotOrder: now });
};

/** Makes `paused` active in `active`'s place by exchanging their slot order. */
export const swapSlots = (paused: Product, active: Product): readonly [Product, Product] => [
  { ...paused, slotOrder: active.slotOrder },
  { ...active, slotOrder: paused.slotOrder },
];
