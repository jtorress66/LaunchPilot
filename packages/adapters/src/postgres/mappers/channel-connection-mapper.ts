import {
  blogPlatformIds,
  channelConnectionId,
  parseHttpUrl,
  productId,
  type ChannelConnection,
} from "@nuvantre/domain";
import type { ChannelConnectionRow } from "../schema";
import { oneOf, readJson, toJson } from "./columns";

const readSettings = (value: unknown): Readonly<Record<string, string>> => {
  const settings = readJson(value);
  const valid =
    typeof settings === "object" &&
    settings !== null &&
    Object.values(settings).every((setting) => typeof setting === "string");
  if (!valid)
    throw new Error(`Unexpected value "${toJson(settings)}" in channel_connections.settings`);
  return settings as Readonly<Record<string, string>>;
};

export const channelConnectionMapper = {
  toRow: (connection: ChannelConnection): ChannelConnectionRow => ({
    id: connection.id,
    product_id: connection.productId,
    channel: connection.channel,
    provider: connection.provider,
    site_url: connection.siteUrl,
    site_name: connection.siteName,
    settings: toJson(connection.settings),
    encrypted_secret: connection.encryptedSecret,
    connected_at: connection.connectedAt,
  }),
  fromRow: (row: ChannelConnectionRow): ChannelConnection => {
    const siteUrl = parseHttpUrl(row.site_url);
    if (!siteUrl.ok) {
      throw new Error(`Unexpected value "${row.site_url}" in channel_connections.site_url`);
    }
    return {
      id: channelConnectionId(row.id),
      productId: productId(row.product_id),
      channel: oneOf(["blog"] as const, row.channel, "channel_connections.channel"),
      provider: oneOf(blogPlatformIds, row.provider, "channel_connections.provider"),
      siteUrl: siteUrl.value,
      siteName: row.site_name,
      settings: readSettings(row.settings),
      encryptedSecret: row.encrypted_secret,
      connectedAt: row.connected_at,
    };
  },
};
