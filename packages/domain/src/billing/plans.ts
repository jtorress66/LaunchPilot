export const planIds = ["free", "starter", "growth", "agency", "client"] as const;
export type PlanId = (typeof planIds)[number];

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  readonly priceMonthlyUsd: number;
  readonly limits: {
    readonly products: number;
    readonly contentItemsPerMonth: number;
    /** Client workspaces an agency may add. */
    readonly clients: number;
  };
}

/** The single source of plan data. Changing a price or limit is a one-line edit here. */
export const plans: Readonly<Record<PlanId, Plan>> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthlyUsd: 0,
    limits: { products: 1, contentItemsPerMonth: 10, clients: 0 },
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthlyUsd: 29,
    limits: { products: 1, contentItemsPerMonth: 60, clients: 0 },
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceMonthlyUsd: 79,
    limits: { products: 3, contentItemsPerMonth: 200, clients: 0 },
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceMonthlyUsd: 199,
    limits: { products: 3, contentItemsPerMonth: 200, clients: 10 },
  },
  /** Not sold: what each client workspace runs on while its agency pays for Agency. */
  client: {
    id: "client",
    name: "Agency client",
    priceMonthlyUsd: 0,
    limits: { products: 3, contentItemsPerMonth: 200, clients: 0 },
  },
};

export const isPaidPlan = (plan: PlanId): boolean => plans[plan].priceMonthlyUsd > 0;
