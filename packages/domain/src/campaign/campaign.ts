import { andThen, map, type Result } from "../result";
import type { DomainError } from "../shared/errors";
import type { CampaignId, ProductId } from "../shared/ids";
import { applyTransition, defineTransitions } from "../shared/state-machine";
import { nonEmptyText } from "../shared/text";

export type CampaignStatus = "planned" | "active" | "completed";
export type CampaignEvent = "start" | "complete";

export interface Campaign {
  readonly id: CampaignId;
  readonly productId: ProductId;
  readonly name: string;
  readonly goal: string;
  readonly weekStarting: Date;
  readonly status: CampaignStatus;
}

const machine = defineTransitions<CampaignStatus, CampaignEvent>({
  planned: { start: "active" },
  active: { complete: "completed" },
  completed: {},
});

export const createCampaign = (input: {
  id: CampaignId;
  productId: ProductId;
  name: string;
  goal: string;
  weekStarting: Date;
}): Result<Campaign, DomainError> =>
  andThen(nonEmptyText(input.name, { field: "Campaign name", max: 200 }), (name) =>
    map(nonEmptyText(input.goal, { field: "Campaign goal", max: 1000 }), (goal) => ({
      id: input.id,
      productId: input.productId,
      name,
      goal,
      weekStarting: input.weekStarting,
      status: "planned" as const,
    })),
  );

export const transitionCampaign = (
  campaign: Campaign,
  event: CampaignEvent,
): Result<Campaign, DomainError> =>
  map(applyTransition(machine, campaign.status, event), (status) => ({ ...campaign, status }));
