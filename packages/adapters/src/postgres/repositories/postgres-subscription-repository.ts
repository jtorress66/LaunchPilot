import type { Subscription, WorkspaceId } from "@nuvantre/domain";
import type { SubscriptionRepository } from "@nuvantre/ports";
import type { Kysely } from "kysely";
import { subscriptionMapper } from "../mappers/subscription-mapper";
import type { Database } from "../schema";

export class PostgresSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByWorkspace(workspaceId: WorkspaceId): Promise<Subscription | undefined> {
    const row = await this.db
      .selectFrom("subscriptions")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .executeTakeFirst();
    return row && subscriptionMapper.fromRow(row);
  }

  async findByProviderSubscriptionId(
    providerSubscriptionId: string,
  ): Promise<Subscription | undefined> {
    const row = await this.db
      .selectFrom("subscriptions")
      .selectAll()
      .where("provider_subscription_id", "=", providerSubscriptionId)
      .executeTakeFirst();
    return row && subscriptionMapper.fromRow(row);
  }

  async save(subscription: Subscription): Promise<void> {
    const row = subscriptionMapper.toRow(subscription);
    await this.db
      .insertInto("subscriptions")
      .values(row)
      .onConflict((conflict) => conflict.column("workspace_id").doUpdateSet(row))
      .execute();
  }
}
