import { productId, type MetricName, type MetricsSnapshot } from "@nuvantre/domain";
import type { MetricsSource } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";

export interface MetricsSourceHarness {
  readonly source: MetricsSource;
  /** The metrics this source reports. */
  readonly metrics: readonly MetricName[];
  /** The connected product's figures for the queried week. */
  givenWeek(values: MetricsSnapshot["values"]): void | Promise<void>;
  /** The product has no connection for this source. */
  givenNotConnected(): void | Promise<void>;
  /** The provider fails (outage, revoked access…). */
  givenFailure(): void | Promise<void>;
}

const query = {
  productId: productId("prod_1"),
  from: new Date("2026-01-05T00:00:00.000Z"),
  to: new Date("2026-01-12T00:00:00.000Z"),
};

const sample: Readonly<Record<MetricName, number>> = {
  visitors: 120,
  pageviews: 300,
  search_clicks: 45,
  search_impressions: 900,
  search_ctr: 0.05,
  search_position: 7.5,
};

export function describeMetricsSourceContract(
  name: string,
  make: () => MetricsSourceHarness | Promise<MetricsSourceHarness>,
): void {
  describe(`MetricsSource contract: ${name}`, () => {
    it("returns its metrics for exactly the requested week, named after the source", async () => {
      const harness = await make();
      const values = Object.fromEntries(harness.metrics.map((m) => [m, sample[m]]));
      await harness.givenWeek(values);
      const result = await harness.source.fetch(query);
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value).toMatchObject({
        source: harness.source.source,
        from: query.from,
        to: query.to,
        values,
      });
    });

    it("reports only its own, non-negative metrics and well-formed rows", async () => {
      const harness = await make();
      await harness.givenWeek(Object.fromEntries(harness.metrics.map((m) => [m, sample[m]])));
      const result = await harness.source.fetch(query);
      if (!result.ok) throw new Error(result.error.message);
      for (const [metric, value] of Object.entries(result.value.values)) {
        expect(harness.metrics).toContain(metric);
        expect(value).toBeGreaterThanOrEqual(0);
      }
      for (const page of result.value.topPages) expect(page.visitors).toBeGreaterThanOrEqual(0);
      for (const q of result.value.topQueries) expect(q.query.trim()).not.toBe("");
    });

    it("answers not_connected when the product has no connection", async () => {
      const harness = await make();
      await harness.givenNotConnected();
      expect(await harness.source.fetch(query)).toMatchObject({
        ok: false,
        error: { code: "not_connected" },
      });
    });

    it("reports a provider failure as a MetricsError result instead of throwing", async () => {
      const harness = await make();
      await harness.givenFailure();
      const result = await harness.source.fetch(query);
      expect(result.ok).toBe(false);
      expect(result.ok ? undefined : result.error.code).not.toBe("not_connected");
    });
  });
}
