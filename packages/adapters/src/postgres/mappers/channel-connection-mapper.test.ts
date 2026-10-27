import { aBlogConnection } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { channelConnectionMapper } from "./channel-connection-mapper";

describe("channelConnectionMapper", () => {
  it("round-trips a blog connection, keeping the secret encrypted", () => {
    const connection = aBlogConnection();
    const row = channelConnectionMapper.toRow(connection);
    expect(row).toMatchObject({
      product_id: "prod_1",
      channel: "blog",
      provider: "wordpress",
      site_url: "https://blog.acme.dev/",
      encrypted_secret: "v1:fixture-ciphertext",
    });
    expect(channelConnectionMapper.fromRow(row)).toEqual(connection);
  });

  it("stores a platform's settings as JSON and reads them back", () => {
    const connection = aBlogConnection({
      platform: "webflow",
      settings: { collectionId: "col_1", bodyField: "post-body" },
    });
    const row = channelConnectionMapper.toRow(connection);
    expect(row).toMatchObject({
      provider: "webflow",
      settings: '{"collectionId":"col_1","bodyField":"post-body"}',
    });
    expect(channelConnectionMapper.fromRow(row)).toEqual(connection);
  });

  it.each([
    ["an unknown channel", { channel: "tiktok" }, /channel_connections\.channel/],
    ["an unknown provider", { provider: "squarespace" }, /channel_connections\.provider/],
    ["an invalid site URL", { site_url: "not a url" }, /channel_connections\.site_url/],
    [
      "settings that are not text values",
      { settings: '{"blogId":1}' },
      /channel_connections\.settings/,
    ],
  ])("refuses %s", (_case, override, message) => {
    const row = { ...channelConnectionMapper.toRow(aBlogConnection()), ...override };
    expect(() => channelConnectionMapper.fromRow(row)).toThrow(message);
  });
});
