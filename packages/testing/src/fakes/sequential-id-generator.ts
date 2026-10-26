import type { IdGenerator } from "@nuvantre/ports";

/** Predictable ids: `id_1`, `id_2`, … */
export class SequentialIdGenerator implements IdGenerator {
  private count = 0;

  constructor(private readonly prefix = "id") {}

  next(): string {
    this.count += 1;
    return `${this.prefix}_${this.count}`;
  }
}
