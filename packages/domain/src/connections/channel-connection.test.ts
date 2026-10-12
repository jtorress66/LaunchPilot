import { describe, expect, it } from "vitest";
import { channelConnectionId, productId } from "../shared/ids";
import { createBlogConnection } from "./channel-connection";

const now = new Date("2026-10-12T00:00:00.000Z");
const input = {
  id: channelConnectionId("conn_1"),
  productId: productId("prod_1"),
  siteUrl: "https://blog.acme.dev",
  username: " admin ",
  encryptedSecret: "v1:iv:tag:ct",
  siteName: "Acme Blog",
  now,
};

describe("createBlogConnection", () => {
  it("creates a WordPress blog connection with a normalised site URL", () => {
    expect(createBlogConnection(input)).toEqual({
      ok: true,
      value: {
        id: "conn_1",
        productId: "prod_1",
        channel: "blog",
        provider: "wordpress",
        siteUrl: "https://blog.acme.dev/",
        siteName: "Acme Blog",
        username: "admin",
        encryptedSecret: "v1:iv:tag:ct",
        connectedAt: now,
      },
    });
  });

  it.each([
    ["an invalid site URL", { siteUrl: "blog" }, "invalid_url"],
    ["a blank username", { username: " " }, "invalid_text"],
    ["a missing secret", { encryptedSecret: "" }, "invalid_text"],
  ])("rejects %s", (_case, override, code) => {
    const result = createBlogConnection({ ...input, ...override });
    expect(result.ok ? undefined : result.error.code).toBe(code);
  });

  it("falls back to the site's host when it has no name", () => {
    const result = createBlogConnection({ ...input, siteName: " " });
    expect(result.ok && result.value.siteName).toBe("blog.acme.dev");
  });
});
