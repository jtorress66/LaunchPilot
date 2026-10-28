import type { TokenHasher } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";

export function describeTokenHasherContract(name: string, make: () => TokenHasher): void {
  describe(`TokenHasher contract: ${name}`, () => {
    it("hashes the same token the same way, and different tokens differently", () => {
      const hasher = make();
      expect(hasher.hash("invite-a")).toBe(make().hash("invite-a"));
      expect(hasher.hash("invite-a")).not.toBe(hasher.hash("invite-b"));
    });

    it("never contains the token", () => {
      expect(make().hash("secret-invite-token")).not.toContain("secret-invite-token");
    });
  });
}
