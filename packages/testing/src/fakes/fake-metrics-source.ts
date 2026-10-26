import { err, ok, type MetricsSnapshot, type ProductId, type Result } from "@nuvantre/domain";
import type { MetricsError, MetricsQuery, MetricsSource } from "@nuvantre/ports";
import { NextFailure } from "./next-failure";

type Week = Pick<MetricsSnapshot, "values"> &
  Partial<Pick<MetricsSnapshot, "topPages" | "topQueries">>;

/** Returns the same figures every week unless a week is set; records queries. */
export class FakeMetricsSource implements MetricsSource {
  readonly queries: MetricsQuery[] = [];
  private readonly failure = new NextFailure<MetricsError>();
  private readonly disconnected = new Set<ProductId>();
  private readonly weeks = new Map<number, Week>();
  private week: Week = { values: {} };

  constructor(readonly source = "search_console") {}

  /** The figures for every week without its own. */
  setValues(values: MetricsSnapshot["values"], rows: Omit<Week, "values"> = {}): void {
    this.week = { values, ...rows };
  }

  /** The figures for the week starting `from`. */
  setWeek(from: Date, values: MetricsSnapshot["values"], rows: Omit<Week, "values"> = {}): void {
    this.weeks.set(from.getTime(), { values, ...rows });
  }

  disconnect(productId: ProductId): void {
    this.disconnected.add(productId);
  }

  failNext(error: MetricsError): void {
    this.failure.set(error);
  }

  fetch(query: MetricsQuery): Promise<Result<MetricsSnapshot, MetricsError>> {
    this.queries.push(query);
    if (this.disconnected.has(query.productId)) {
      return Promise.resolve(
        err({
          code: "not_connected",
          message: `${this.source} is not connected`,
          retryable: false,
        }),
      );
    }
    const error = this.failure.take();
    if (error) return Promise.resolve(err(error));
    const week = this.weeks.get(query.from.getTime()) ?? this.week;
    return Promise.resolve(
      ok({
        source: this.source,
        from: query.from,
        to: query.to,
        values: week.values,
        topPages: week.topPages ?? [],
        topQueries: week.topQueries ?? [],
      }),
    );
  }
}
