import type { IdGenerator } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";

export function describeIdGeneratorContract(name: string, make: () => IdGenerator): void {
  describe(`IdGenerator contract: ${name}`, () => {
    it("returns a non-empty id", () => {
      expect(make().next()).not.toBe("");
    });

    it("never repeats an id", () => {
      const generator = make();
      const ids = Array.from({ length: 1000 }, () => generator.next());
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
}
