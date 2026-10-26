import { err, ok, type Result } from "@nuvantre/domain";
import type { PortError } from "@nuvantre/ports";
import { z } from "zod";
import { callGoogle, unreachable, urlsOf, type GoogleOptions } from "./api";

const refreshed = z.object({ access_token: z.string().min(1) });

export type AccessTokenError = PortError<"invalid_credentials" | "unavailable">;

/** A short-lived access token for the stored refresh token, fetched fresh for each run. */
export const accessTokenFor = async (
  options: GoogleOptions,
  refreshToken: string,
): Promise<Result<string, AccessTokenError>> => {
  const response = await callGoogle(options, {
    method: "POST",
    url: urlsOf(options).token,
    form: {
      client_id: options.clientId,
      client_secret: options.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    },
  });
  if (!response.ok) return err(unreachable("sign-in"));
  const { status, body } = response.value;
  const parsed = refreshed.safeParse(body);
  if (status === 200 && parsed.success) return ok(parsed.data.access_token);
  if (status === 400 || status === 401) {
    return err({
      code: "invalid_credentials",
      message: "Google access was revoked or expired: connect Google again",
      retryable: false,
    });
  }
  return err({
    code: "unavailable",
    message: `Google sign-in did not answer (HTTP ${String(status)})`,
    retryable: true,
  });
};
