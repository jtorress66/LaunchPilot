import { err, ok, type Result, type SocialChannel } from "@launchpilot/domain";
import type { Clock } from "@launchpilot/ports";
import { z } from "zod";

export interface AyrshareOptions {
  /** The primary account's API key (Business plan). Never logged. */
  readonly apiKey: string;
  /** Linking page: the domain and RSA private key from Ayrshare's Business dashboard. */
  readonly domain: string;
  readonly privateKey: string;
  /** Since March 2026 X calls through Ayrshare need your own X developer app's keys. */
  readonly xCredentials?: { readonly apiKey: string; readonly apiSecret: string };
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly clock: Clock;
}

/** Ayrshare's name for each channel LaunchPilot publishes to. */
export const platformOf: Readonly<Record<SocialChannel, string>> = {
  x: "twitter",
  linkedin: "linkedin",
};

export const channelOf = (platform: string): SocialChannel | undefined =>
  (Object.keys(platformOf) as SocialChannel[]).find((c) => platformOf[c] === platform);

export interface AyrshareResponse {
  readonly status: number;
  readonly body: unknown;
}

const errorBody = z.object({
  message: z.string().optional(),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

/**
 * Ayrshare's own explanation of a failure. It names the problem, never a key; anything
 * longer than a sentence or two is cut so a surprising body cannot flood the founder's screen.
 */
export const ayrshareMessage = (body: unknown): string | undefined => {
  const parsed = errorBody.safeParse(body);
  if (!parsed.success) return undefined;
  const message = parsed.data.errors?.[0]?.message ?? parsed.data.message;
  return message?.slice(0, 300);
};

interface Call {
  readonly method: "GET" | "POST" | "DELETE";
  readonly path: string;
  readonly body?: Readonly<Record<string, unknown>>;
  readonly profileKey?: string;
  /** Adds the X app credentials, for calls that act on X. */
  readonly forX?: boolean;
}

/** One authenticated request to Ayrshare's REST API. Only "the network failed" is an error here. */
export const callAyrshare = async (
  options: AyrshareOptions,
  call: Call,
): Promise<Result<AyrshareResponse, "network">> => {
  const headers: Record<string, string> = {
    authorization: `Bearer ${options.apiKey}`,
    "content-type": "application/json",
  };
  if (call.profileKey !== undefined) headers["profile-key"] = call.profileKey;
  if (call.forX === true && options.xCredentials !== undefined) {
    headers["x-twitter-oauth1-api-key"] = options.xCredentials.apiKey;
    headers["x-twitter-oauth1-api-secret"] = options.xCredentials.apiSecret;
  }
  const base = options.baseUrl ?? "https://api.ayrshare.com";
  try {
    const response = await fetch(`${base}/api/${call.path}`, {
      method: call.method,
      headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      ...(call.body === undefined ? {} : { body: JSON.stringify(call.body) }),
    });
    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = undefined;
    }
    return ok({ status: response.status, body });
  } catch {
    return err("network");
  }
};

export const isOutage = (status: number) => status === 429 || status >= 500;
