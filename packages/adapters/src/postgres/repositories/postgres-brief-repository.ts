import type { Brief, BriefId, ProductId } from "@launchpilot/domain";
import type { BriefRepository } from "@launchpilot/ports";
import type { Kysely } from "kysely";
import { briefMapper } from "../mappers/brief-mapper";
import type { Database } from "../schema";
import { upsert } from "../upsert";

export class PostgresBriefRepository implements BriefRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: BriefId): Promise<Brief | undefined> {
    const row = await this.db
      .selectFrom("briefs")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row && briefMapper.fromRow(row);
  }

  save(brief: Brief): Promise<void> {
    return upsert(this.db, "briefs", briefMapper.toRow(brief));
  }

  async findLatestForProduct(productId: ProductId): Promise<Brief | undefined> {
    const row = await this.db
      .selectFrom("briefs")
      .selectAll()
      .where("product_id", "=", productId)
      .orderBy("updated_at", "desc")
      .limit(1)
      .executeTakeFirst();
    return row && briefMapper.fromRow(row);
  }
}
