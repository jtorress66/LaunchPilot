import {
  autopilotRunId,
  productId,
  type AutopilotRun,
  type AutopilotRunOutcome,
  type ProductId,
} from "@nuvantre/domain";
import type { AutopilotRunRepository } from "@nuvantre/ports";
import type { Kysely } from "kysely";
import { readJson, toJson } from "../mappers/columns";
import type { AutopilotRunRow, Database } from "../schema";

const toRow = (run: AutopilotRun): AutopilotRunRow => ({
  id: run.id,
  product_id: run.productId,
  week_start: run.week.start,
  week_end: run.week.end,
  outcome: toJson(run.outcome),
  ran_at: run.ranAt,
});

const fromRow = (row: AutopilotRunRow): AutopilotRun => ({
  id: autopilotRunId(row.id),
  productId: productId(row.product_id),
  week: { start: row.week_start, end: row.week_end },
  outcome: readJson(row.outcome) as AutopilotRunOutcome,
  ranAt: row.ran_at,
});

export class PostgresAutopilotRunRepository implements AutopilotRunRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByProductAndWeek(
    product: ProductId,
    weekStart: Date,
  ): Promise<AutopilotRun | undefined> {
    const row = await this.db
      .selectFrom("autopilot_runs")
      .selectAll()
      .where("product_id", "=", product)
      .where("week_start", "=", weekStart)
      .executeTakeFirst();
    return row && fromRow(row);
  }

  async latestForProduct(product: ProductId): Promise<AutopilotRun | undefined> {
    const row = await this.db
      .selectFrom("autopilot_runs")
      .selectAll()
      .where("product_id", "=", product)
      .orderBy("week_start", "desc")
      .limit(1)
      .executeTakeFirst();
    return row && fromRow(row);
  }

  async save(run: AutopilotRun): Promise<void> {
    const row = toRow(run);
    await this.db
      .insertInto("autopilot_runs")
      .values(row)
      .onConflict((c) => c.columns(["product_id", "week_start"]).doUpdateSet(row))
      .execute();
  }
}
