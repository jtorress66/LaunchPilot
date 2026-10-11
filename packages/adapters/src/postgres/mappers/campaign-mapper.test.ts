import { aCampaign } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { campaignMapper } from "./campaign-mapper";

describe("campaignMapper", () => {
  it("round-trips a campaign", () => {
    const campaign = aCampaign();
    const row = campaignMapper.toRow(campaign);
    expect(row).toMatchObject({ product_id: "prod_1", week_starting: campaign.weekStarting });
    expect(campaignMapper.fromRow(row)).toEqual(campaign);
  });

  it("refuses an unknown status", () => {
    const row = { ...campaignMapper.toRow(aCampaign()), status: "paused" };
    expect(() => campaignMapper.fromRow(row)).toThrow(/campaigns\.status/);
  });
});
