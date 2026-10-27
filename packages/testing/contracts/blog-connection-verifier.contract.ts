import type { BlogConnectionVerifier, BlogCredentials } from "@nuvantre/ports";
import { describe, expect, it } from "vitest";

export interface BlogConnectionVerifierHarness {
  readonly verifier: BlogConnectionVerifier;
  /** Credentials the harness's blog accepts. */
  readonly valid: BlogCredentials;
}

export function describeBlogConnectionVerifierContract(
  name: string,
  make: () => BlogConnectionVerifierHarness | Promise<BlogConnectionVerifierHarness>,
): void {
  describe(`BlogConnectionVerifier contract: ${name}`, () => {
    it("accepts working credentials and names the site and its address", async () => {
      const { verifier, valid } = await make();
      const result = await verifier.verify(valid);
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.siteName.trim()).not.toBe("");
      expect(result.value.siteUrl).toMatch(/^https?:\/\//);
      // Whatever the founder typed is kept, alongside anything the verifier looked up.
      expect(result.value.settings).toMatchObject(valid.settings);
    });

    it("rejects a wrong key or password as invalid_credentials, without echoing it", async () => {
      const { verifier, valid } = await make();
      const wrong = { ...valid, secret: "wrong-password-1234" };
      const result = await verifier.verify(wrong);
      expect(result).toMatchObject({ ok: false, error: { code: "invalid_credentials" } });
      if (result.ok) return;
      expect(result.error.message).not.toContain(wrong.secret);
    });
  });
}
