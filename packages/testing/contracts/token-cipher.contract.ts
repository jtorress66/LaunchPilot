import type { TokenCipher } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";

export function describeTokenCipherContract(name: string, make: () => TokenCipher): void {
  describe(`TokenCipher contract: ${name}`, () => {
    it.each(["ya29.a0-oauth-token", "émoji ✓ token", "x"])(
      "decrypts %j back to the original",
      async (secret) => {
        const cipher = make();
        expect(await cipher.decrypt(await cipher.encrypt(secret))).toBe(secret);
      },
    );

    it("never stores the secret in readable form", async () => {
      const secret = "super-secret-refresh-token";
      const ciphertext = await make().encrypt(secret);
      expect(ciphertext).not.toContain(secret);
    });
  });
}
