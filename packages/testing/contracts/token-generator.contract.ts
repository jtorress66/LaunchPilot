import type { TokenGenerator } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";

export function describeTokenGeneratorContract(
  name: string,
  make: () => TokenGenerator,
  { minLength }: { minLength: number },
): void {
  describe(`TokenGenerator contract: ${name}`, () => {
    it(`returns URL-safe tokens of at least ${minLength} characters`, () => {
      const token = make().generate();
      expect(token.length).toBeGreaterThanOrEqual(minLength);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("never repeats a token", () => {
      const generator = make();
      const tokens = Array.from({ length: 1000 }, () => generator.generate());
      expect(new Set(tokens).size).toBe(tokens.length);
    });
  });
}
