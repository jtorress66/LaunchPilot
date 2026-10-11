import type { PasswordHasher } from "@launchpilot/ports";
import { describe, expect, it } from "vitest";

const password = "correct horse battery staple";

export function describePasswordHasherContract(name: string, make: () => PasswordHasher): void {
  describe(`PasswordHasher contract: ${name}`, () => {
    it("verifies the password it hashed", async () => {
      const hasher = make();
      expect(await hasher.verify(password, await hasher.hash(password))).toBe(true);
    });

    it("rejects a different password", async () => {
      const hasher = make();
      expect(await hasher.verify("wrong horse battery staple", await hasher.hash(password))).toBe(
        false,
      );
    });

    it("salts every hash, so equal passwords produce different hashes", async () => {
      const hasher = make();
      expect(await hasher.hash(password)).not.toBe(await hasher.hash(password));
    });

    it("never contains the password", async () => {
      expect(await make().hash(password)).not.toContain(password);
    });

    it("rejects a malformed hash instead of throwing", async () => {
      expect(await make().verify(password, "not-a-hash")).toBe(false);
    });
  });
}
