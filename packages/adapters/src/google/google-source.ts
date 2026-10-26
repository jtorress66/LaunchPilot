import { err, ok, type GoogleConnection, type Result } from "@nuvantre/domain";
import type {
  AnalyticsConnectionRepository,
  MetricsError,
  MetricsQuery,
  TokenCipher,
} from "@nuvantre/ports";
import { accessTokenFor } from "./access-token";
import type { GoogleOptions } from "./api";

export interface GoogleAccess {
  readonly connection: GoogleConnection;
  readonly accessToken: string;
}

/**
 * What every Google source does first: find the product's Google connection, check the
 * property it needs was chosen, and swap the stored refresh token for an access token.
 */
export interface GoogleAccessDeps {
  readonly connections: AnalyticsConnectionRepository;
  readonly cipher: TokenCipher;
  readonly options: GoogleOptions;
}

export const googleAccess = async (
  deps: GoogleAccessDeps,
  query: MetricsQuery,
  chosen: (connection: GoogleConnection) => boolean,
  name: string,
): Promise<Result<GoogleAccess, MetricsError>> => {
  const connection = await deps.connections.find(query.productId, "google");
  if (!connection || !chosen(connection)) {
    return err({ code: "not_connected", message: `Connect ${name} first`, retryable: false });
  }
  const refreshToken = await deps.cipher.decrypt(connection.encryptedSecret);
  const token = await accessTokenFor(deps.options, refreshToken);
  return token.ok ? ok({ connection, accessToken: token.value }) : err(token.error);
};
