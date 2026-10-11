import { campaignId, campaignStatuses, productId, type Campaign } from "@launchpilot/domain";
import type { CampaignRow } from "../schema";
import { oneOf } from "./columns";

export const campaignMapper = {
  toRow: (campaign: Campaign): CampaignRow => ({
    id: campaign.id,
    product_id: campaign.productId,
    name: campaign.name,
    goal: campaign.goal,
    week_starting: campaign.weekStarting,
    status: campaign.status,
  }),
  fromRow: (row: CampaignRow): Campaign => ({
    id: campaignId(row.id),
    productId: productId(row.product_id),
    name: row.name,
    goal: row.goal,
    weekStarting: row.week_starting,
    status: oneOf(campaignStatuses, row.status, "campaigns.status"),
  }),
};
