import type { Campaign, CampaignId, ProductId } from "@nuvantre/domain";
import type { CampaignRepository } from "@nuvantre/ports";
import type { Kysely } from "kysely";
import { campaignMapper } from "../mappers/campaign-mapper";
import type { Database } from "../schema";
import { upsert } from "../upsert";

export class PostgresCampaignRepository implements CampaignRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: CampaignId): Promise<Campaign | undefined> {
    const row = await this.db
      .selectFrom("campaigns")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row && campaignMapper.fromRow(row);
  }

  save(campaign: Campaign): Promise<void> {
    return upsert(this.db, "campaigns", campaignMapper.toRow(campaign));
  }

  async listByProduct(productId: ProductId): Promise<readonly Campaign[]> {
    const rows = await this.db
      .selectFrom("campaigns")
      .selectAll()
      .where("product_id", "=", productId)
      .orderBy("week_starting", "desc")
      .orderBy("id")
      .execute();
    return rows.map(campaignMapper.fromRow);
  }
}
