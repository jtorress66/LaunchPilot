import { err, ok, type Result } from "@nuvantre/domain";
import type { PortError } from "@nuvantre/ports";
import { z } from "zod";

export interface GoogleUrls {
  readonly consent: string;
  readonly token: string;
  readonly searchConsole: string;
  readonly analyticsData: string;
  readonly analyticsAdmin: string;
}

export interface GoogleOptions {
  /** From GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. The secret is never logged or echoed. */
  readonly clientId: string;
  readonly clientSecret: string;
  /** Development and test only: point Google's endpoints at a local stand-in. */
  readonly urls?: Partial<GoogleUrls>;
  readonly timeoutMs?: number;
}

const defaults: GoogleUrls = {
  consent: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  searchConsole: "https://www.googleapis.com/webmasters/v3",
  analyticsData: "https://analyticsdata.googleapis.com/v1beta",
  analyticsAdmin: "https://analyticsadmin.googleapis.com/v1beta",
};

export const urlsOf = (options: GoogleOptions): GoogleUrls => ({ ...defaults, ...options.urls });

/** Every Google endpoint under one local stand-in (`scripts/e2e-analytics.mjs`). Dev and test only. */
export const googleStubUrls = (baseUrl: string): GoogleUrls => {
  const base = baseUrl.replace(/\/$/, "");
  return {
    consent: `${base}/o/oauth2/v2/auth`,
    token: `${base}/token`,
    searchConsole: `${base}/webmasters/v3`,
    analyticsData: `${base}/data/v1beta`,
    analyticsAdmin: `${base}/admin/v1beta`,
  };
};

/** Read-only access only; `openid email` names the account the founder signed in with. */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
] as const;

export interface GoogleResponse {
  readonly status: number;
  readonly body: unknown;
}

interface Call {
  readonly method: "GET" | "POST";
  readonly url: string;
  readonly accessToken?: string;
  readonly form?: Readonly<Record<string, string>>;
  readonly json?: unknown;
}

/** One request to a Google API. Only "the network failed" is an error here. */
export const callGoogle = async (
  options: GoogleOptions,
  call: Call,
): Promise<Result<GoogleResponse, "network">> => {
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (call.accessToken !== undefined) headers.authorization = `Bearer ${call.accessToken}`;
  if (call.form !== undefined) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(call.form).toString();
  } else if (call.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(call.json);
  }
  try {
    const response = await fetch(call.url, {
      method: call.method,
      headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      ...(body === undefined ? {} : { body }),
    });
    const text = await response.text();
    try {
      return ok({ status: response.status, body: JSON.parse(text) as unknown });
    } catch {
      return ok({ status: response.status, body: undefined });
    }
  } catch {
    return err("network");
  }
};

const apiError = z.object({ error: z.object({ message: z.string(), status: z.string() }) });

/** Google's own explanation, which names the property but never a token. Capped in length. */
export const googleMessage = (body: unknown): string | undefined => {
  const parsed = apiError.safeParse(body);
  return parsed.success ? parsed.data.error.message.slice(0, 300) : undefined;
};

type ApiCode = "invalid_credentials" | "no_access" | "unavailable";

/** Maps a failed API response onto the codes the ports share. */
export const apiFailure = (status: number, body: unknown, what: string): PortError<ApiCode> => {
  if (status === 401) {
    return { code: "invalid_credentials", message: "Google access was revoked", retryable: false };
  }
  if (status === 403 || status === 404) {
    return {
      code: "no_access",
      message: googleMessage(body) ?? `The Google account cannot read this ${what}`,
      retryable: false,
    };
  }
  return {
    code: "unavailable",
    message: googleMessage(body) ?? `Google ${what} did not answer (HTTP ${String(status)})`,
    retryable: status === 429 || status >= 500,
  };
};

export const unreachable = (what: string): PortError<"unavailable"> => ({
  code: "unavailable",
  message: `Google ${what} could not be reached`,
  retryable: true,
});

const DAY = 86_400_000;

/** Google takes inclusive calendar dates: a week ending Monday 00:00 ends on Sunday. */
export const dateRangeOf = (from: Date, to: Date) => ({
  startDate: from.toISOString().slice(0, 10),
  endDate: new Date(to.getTime() - DAY).toISOString().slice(0, 10),
});
