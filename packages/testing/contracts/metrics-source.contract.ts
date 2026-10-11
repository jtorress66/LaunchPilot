import { productId } from "@launchpilot/domain";
import type { MetricsSnapshot, MetricsSource } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";

export interface MetricsSourceHarness {
  readonly source: MetricsSource;
  givenValues(values: MetricsSnapshot["values"]): void | Promise<void>;
  givenFailure(): void | Promise<void>;
}

const query = {
  productId: productId("prod_1"),
  from: new Date("2026-01-05T00:00:00.000Z"),
  to: new Date("2026-01-12T00:00:00.000Z"),
};

export function describeMetricsSourceContract(
  name: string,
  make: () => MetricsSourceHarness | Promise<MetricsSourceHarness>,
): void {
  describe(`MetricsSource contract: ${name}`, () => {
    it("returns non-negative metrics for exactly the requested range", async () => {
      const harness = await make();
      await harness.givenValues({ visitors: 120, search_clicks: 45 });
      const result = await harness.source.fetch(query);
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.from).toEqual(query.from);
      expect(result.value.to).toEqual(query.to);
      expect(result.value.values).toMatchObject({ visitors: 120, search_clicks: 45 });
      for (const value of Object.values(result.value.values))
        expect(value).toBeGreaterThanOrEqual(0);
    });

    it("reports a failure as a MetricsError result instead of throwing", async () => {
      const harness = await make();
      await harness.givenFailure();
      expect((await harness.source.fetch(query)).ok).toBe(false);
    });
  });
}
