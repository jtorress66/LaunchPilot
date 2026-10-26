import type {
  AnalyticsConnection,
  AnalyticsProvider,
  ProductId,
  WeeklyReport,
} from "@nuvantre/domain";
import { productId } from "@nuvantre/domain";
import type { AnalyticsConnectionRepository, WeeklyReportRepository } from "@nuvantre/ports";
import type { Kysely } from "kysely";
import { analyticsConnectionMapper, weeklyReportMapper } from "../mappers/analytics-mappers";
import type { Database } from "../schema";

export class PostgresAnalyticsConnectionRepository implements AnalyticsConnectionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async find<P extends AnalyticsProvider>(
    product: ProductId,
    provider: P,
  ): Promise<Extract<AnalyticsConnection, { provider: P }> | undefined> {
    const row = await this.db
      .selectFrom("analytics_connections")
      .selectAll()
      .where("product_id", "=", product)
      .where("provider", "=", provider)
      .executeTakeFirst();
    // The row was selected by provider, so the mapped union member is the one asked for.
    return (
      row &&
      (analyticsConnectionMapper.fromRow(row) as Extract<AnalyticsConnection, { provider: P }>)
    );
  }

  async listByProduct(product: ProductId): Promise<readonly AnalyticsConnection[]> {
    const rows = await this.db
      .selectFrom("analytics_connections")
      .selectAll()
      .where("product_id", "=", product)
      .orderBy("provider")
      .execute();
    return rows.map(analyticsConnectionMapper.fromRow);
  }

  async listConnectedProductIds(): Promise<readonly ProductId[]> {
    const rows = await this.db
      .selectFrom("analytics_connections")
      .select("product_id")
      .distinct()
      .orderBy("product_id")
      .execute();
    return rows.map((r) => productId(r.product_id));
  }

  async save(connection: AnalyticsConnection): Promise<void> {
    const row = analyticsConnectionMapper.toRow(connection);
    await this.db
      .insertInto("analytics_connections")
      .values(row)
      .onConflict((c) => c.columns(["product_id", "provider"]).doUpdateSet(row))
      .execute();
  }

  async delete(product: ProductId, provider: AnalyticsProvider): Promise<void> {
    await this.db
      .deleteFrom("analytics_connections")
      .where("product_id", "=", product)
      .where("provider", "=", provider)
      .execute();
  }
}

export class PostgresWeeklyReportRepository implements WeeklyReportRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByProductAndWeek(
    product: ProductId,
    weekKey: string,
  ): Promise<WeeklyReport | undefined> {
    const row = await this.db
      .selectFrom("weekly_reports")
      .selectAll()
      .where("product_id", "=", product)
      .where("week_key", "=", weekKey)
      .executeTakeFirst();
    return row && weeklyReportMapper.fromRow(row);
  }

  async listByProduct(product: ProductId): Promise<readonly WeeklyReport[]> {
    const rows = await this.db
      .selectFrom("weekly_reports")
      .selectAll()
      .where("product_id", "=", product)
      .orderBy("week_start", "desc")
      .execute();
    return rows.map(weeklyReportMapper.fromRow);
  }

  async save(report: WeeklyReport): Promise<void> {
    const row = weeklyReportMapper.toRow(report);
    await this.db
      .insertInto("weekly_reports")
      .values(row)
      .onConflict((c) => c.columns(["product_id", "week_key"]).doUpdateSet(row))
      .execute();
  }
}
