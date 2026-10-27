import { productId } from "@nuvantre/domain";
import {
  aBlogConnection,
  FakePublisher,
  FakeTokenCipher,
  InMemoryChannelConnectionRepository,
} from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { BlogPublisherProvider } from "./blog-publisher-provider";

const setUp = async (platform: "wordpress" | "ghost") => {
  const connections = new InMemoryChannelConnectionRepository();
  const cipher = new FakeTokenCipher();
  await connections.save({
    ...aBlogConnection({
      platform,
      settings: platform === "wordpress" ? { username: "admin" } : {},
    }),
    encryptedSecret: await cipher.encrypt("the-key"),
  });
  const built: { platform: string; secret: string; siteUrl: string }[] = [];
  const factory = (platformName: string) => (connection: { siteUrl: string }, secret: string) => {
    built.push({ platform: platformName, secret, siteUrl: connection.siteUrl });
    return new FakePublisher("blog");
  };
  const provider = new BlogPublisherProvider(connections, cipher, {
    wordpress: factory("wordpress"),
    ghost: factory("ghost"),
  });
  return { provider, built };
};

describe("BlogPublisherProvider", () => {
  it("builds the publisher for the platform the product connected, with the decrypted key", async () => {
    const { provider, built } = await setUp("ghost");
    const result = await provider.forProduct(productId("prod_1"));
    expect(result.ok && result.value.channel).toBe("blog");
    expect(built).toEqual([
      { platform: "ghost", secret: "the-key", siteUrl: "https://blog.acme.dev/" },
    ]);
  });

  it("asks the founder to connect a blog first", async () => {
    const { provider } = await setUp("wordpress");
    expect(await provider.forProduct(productId("prod_2"))).toEqual({
      ok: false,
      error: { code: "not_connected", message: "Connect your blog first", retryable: false },
    });
  });

  it("explains when the connected platform has no publisher wired", async () => {
    const connections = new InMemoryChannelConnectionRepository();
    await connections.save(aBlogConnection({ platform: "wix", settings: { siteId: "s1" } }));
    const provider = new BlogPublisherProvider(connections, new FakeTokenCipher(), {});
    expect(await provider.forProduct(productId("prod_1"))).toEqual({
      ok: false,
      error: {
        code: "not_connected",
        message: "Publishing to Wix is not available yet",
        retryable: false,
      },
    });
  });
});
