import { err, ok, type Result, type SocialChannel } from "@launchpilot/domain";
import type { Clock } from "@launchpilot/ports";
import { z } from "zod";

export interface ZernioOptions {
  /** The account's API key (`sk_…`), from ZERNIO_API_KEY. Never logged or echoed. */
  readonly apiKey: string;
  /** Defaults to https://zernio.com/api; tests point it at a local stand-in. */
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly clock: Clock;
}

/** Zernio's name for each channel LaunchPilot publishes to. */
export const platformOf: Readonly<Record<SocialChannel, string>> = {
  x: "twitter",
  linkedin: "linkedin",
};

export const channelOf = (platform: string): SocialChannel | undefined =>
  (Object.keys(platformOf) as SocialChannel[]).find((c) => platformOf[c] === platform);

export const channelNames: Readonly<Record<SocialChannel, string>> = {
  x: "X",
  linkedin: "LinkedIn",
};

export interface ZernioResponse {
  readonly status: number;
  readonly body: unknown;
}

const errorBody = z.object({ error: z.string().optional(), code: z.string().optional() });

/** Zernio's machine-readable error code, if the body has one. */
export const zernioCode = (body: unknown): string | undefined => {
  const parsed = errorBody.safeParse(body);
  return parsed.success ? parsed.data.code : undefined;
};

/** Zernio's own explanation of a failure: it names the problem, never the key. Capped in length. */
export const zernioMessage = (body: unknown): string | undefined => {
  const parsed = errorBody.safeParse(body);
  return parsed.success ? parsed.data.error?.slice(0, 300) : undefined;
};

interface Call {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly body?: Readonly<Record<string, unknown>>;
  readonly idempotencyKey?: string;
}

/** One authenticated request to Zernio's REST API. Only "the network failed" is an error here. */
export const callZernio = async (
  options: ZernioOptions,
  call: Call,
): Promise<Result<ZernioResponse, "network">> => {
  const url = new URL(`${options.baseUrl ?? "https://zernio.com/api"}/v1/${call.path}`);
  for (const [key, value] of Object.entries(call.query ?? {})) url.searchParams.set(key, value);
  const headers: Record<string, string> = {
    authorization: `Bearer ${options.apiKey}`,
    "content-type": "application/json",
  };
  if (call.idempotencyKey !== undefined) headers["idempotency-key"] = call.idempotencyKey;
  try {
    const response = await fetch(url, {
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
