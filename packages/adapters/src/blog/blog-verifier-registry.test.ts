import { FakeBlogConnectionVerifier } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { BlogVerifierRegistry } from "./blog-verifier-registry";

const ghost = {
  platform: "ghost" as const,
  siteUrl: "https://acme.ghost.io/",
  settings: {},
  secret: "id:secret",
};

describe("BlogVerifierRegistry", () => {
  it("hands the credentials to the verifier of their platform", async () => {
    const ghostVerifier = new FakeBlogConnectionVerifier().accept(ghost, "Acme");
    const wordpress = new FakeBlogConnectionVerifier();
    const registry = new BlogVerifierRegistry({ ghost: ghostVerifier, wordpress });
    expect(await registry.verify(ghost)).toMatchObject({ ok: true, value: { siteName: "Acme" } });
    expect(ghostVerifier.attempts).toHaveLength(1);
    expect(wordpress.attempts).toHaveLength(0);
  });

  it("refuses a platform it has no verifier for", async () => {
    expect(await new BlogVerifierRegistry({}).verify(ghost)).toEqual({
      ok: false,
      error: {
        code: "wrong_platform",
        message: "Connecting a Ghost blog is not available yet",
        retryable: false,
      },
    });
  });
});
