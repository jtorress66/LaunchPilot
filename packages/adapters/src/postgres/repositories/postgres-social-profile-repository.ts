import type { ProductId, SocialProfile } from "@launchpilot/domain";
import type { SocialProfileRepository } from "@launchpilot/ports";
import type { Kysely } from "kysely";
import { socialProfileMapper } from "../mappers/social-profile-mapper";
import type { Database } from "../schema";

export class PostgresSocialProfileRepository implements SocialProfileRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByProduct(productId: ProductId): Promise<SocialProfile | undefined> {
    const row = await this.db
      .selectFrom("social_profiles")
      .selectAll()
      .where("product_id", "=", productId)
      .executeTakeFirst();
    return row && socialProfileMapper.fromRow(row);
  }

  /** One profile per product: saving again replaces it. */
  async save(profile: SocialProfile): Promise<void> {
    const row = socialProfileMapper.toRow(profile);
    await this.db
      .insertInto("social_profiles")
      .values(row)
      .onConflict((conflict) => conflict.column("product_id").doUpdateSet(row))
      .execute();
  }
}
