import {
  channelConnectionId,
  parseHttpUrl,
  productId,
  type ChannelConnection,
} from "@launchpilot/domain";
import type { ChannelConnectionRow } from "../schema";
import { oneOf } from "./columns";

export const channelConnectionMapper = {
  toRow: (connection: ChannelConnection): ChannelConnectionRow => ({
    id: connection.id,
    product_id: connection.productId,
    channel: connection.channel,
    provider: connection.provider,
    site_url: connection.siteUrl,
    site_name: connection.siteName,
    username: connection.username,
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
      provider: oneOf(["wordpress"] as const, row.provider, "channel_connections.provider"),
      siteUrl: siteUrl.value,
      siteName: row.site_name,
      username: row.username,
      encryptedSecret: row.encrypted_secret,
      connectedAt: row.connected_at,
    };
  },
};
