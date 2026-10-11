import { err, ok, type Result } from "@launchpilot/domain";
import type {
  MetricsError,
  MetricsQuery,
  MetricsSnapshot,
  MetricsSource,
} from "@launchpilot/ports";
import { NextFailure } from "./next-failure";

export class FakeMetricsSource implements MetricsSource {
  private readonly failure = new NextFailure<MetricsError>();
  private values: MetricsSnapshot["values"] = {};
  private topPages: MetricsSnapshot["topPages"] = [];

  setValues(values: MetricsSnapshot["values"], topPages: MetricsSnapshot["topPages"] = []): void {
    this.values = values;
    this.topPages = topPages;
  }

  failNext(error: MetricsError): void {
    this.failure.set(error);
  }

  fetch(query: MetricsQuery): Promise<Result<MetricsSnapshot, MetricsError>> {
    const error = this.failure.take();
    if (error) return Promise.resolve(err(error));
    return Promise.resolve(
      ok({
        source: "fake",
        from: query.from,
        to: query.to,
        values: this.values,
        topPages: this.topPages,
      }),
    );
  }
}
