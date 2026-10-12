import type { Channel, ChannelConnection, ProductId } from "@launchpilot/domain";
import type { ChannelConnectionRepository } from "@launchpilot/ports";
import type { Kysely } from "kysely";
import { channelConnectionMapper } from "../mappers/channel-connection-mapper";
import type { Database } from "../schema";

export class PostgresChannelConnectionRepository implements ChannelConnectionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByProductAndChannel(
    productId: ProductId,
    channel: Channel,
  ): Promise<ChannelConnection | undefined> {
    const row = await this.db
      .selectFrom("channel_connections")
      .selectAll()
      .where("product_id", "=", productId)
      .where("channel", "=", channel)
      .executeTakeFirst();
    return row && channelConnectionMapper.fromRow(row);
  }

  /** One connection per product and channel: reconnecting replaces the old one. */
  async save(connection: ChannelConnection): Promise<void> {
    const row = channelConnectionMapper.toRow(connection);
    await this.db
      .insertInto("channel_connections")
      .values(row)
      .onConflict((conflict) => conflict.columns(["product_id", "channel"]).doUpdateSet(row))
      .execute();
  }
}
