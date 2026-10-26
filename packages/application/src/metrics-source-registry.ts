import type { MetricsSource } from "@nuvantre/ports";

/**
 * The analytics sources a weekly report reads. A new source is a new registration here, wired
 * in the composition root; nothing else changes.
 */
export class MetricsSourceRegistry {
  constructor(private readonly sources: readonly MetricsSource[]) {
    const names = sources.map((s) => s.source);
    if (new Set(names).size !== names.length) {
      throw new Error(`Each analytics source must be registered once: ${names.join(", ")}`);
    }
  }

  all(): readonly MetricsSource[] {
    return this.sources;
  }
}
