import { err, ok, type Result } from "@launchpilot/domain";
import { z } from "zod";
import { safeRequest, type HttpFailure, type SafeHttpOptions } from "../net/safe-http";

export const PLAUSIBLE_USER_AGENT = "LaunchPilot/1.0 (+https://launchpilot.app)";

export interface PlausibleNetwork {
  /** Development and test only: lets LaunchPilot reach a self-hosted Plausible on a LAN. */
  readonly allowPrivateNetwork: boolean;
  readonly timeoutMs?: number;
}

const httpOptions = ({ allowPrivateNetwork, timeoutMs }: PlausibleNetwork): SafeHttpOptions => ({
  policy: { allowPrivateNetwork },
  userAgent: PLAUSIBLE_USER_AGENT,
  timeoutMs: timeoutMs ?? 20_000,
  maxBytes: 1_000_000,
});

const results = z.object({
  results: z.array(
    z.object({
      metrics: z.array(z.number().nonnegative()),
      dimensions: z.array(z.string()),
    }),
  ),
});

export type StatsRows = z.infer<typeof results>["results"];

const errorBody = z.object({ error: z.string() });

export type StatsFailure =
  | { readonly kind: "invalid_key" }
  | { readonly kind: "site_not_found" }
  | { readonly kind: "http"; readonly status: number }
  | { readonly kind: "network"; readonly failure: HttpFailure };

/**
 * Plausible answers 401 both for a bad key and for a site the key cannot see. Only the second
 * message names the site ID, so that is how the two are told apart.
 */
const unauthorised = (body: string): StatsFailure => {
  try {
    const parsed = errorBody.safeParse(JSON.parse(body));
    return parsed.success && /site id/i.test(parsed.data.error)
      ? { kind: "site_not_found" }
      : { kind: "invalid_key" };
  } catch {
    return { kind: "invalid_key" };
  }
};

/** One Stats API v2 query, over the SSRF-guarded client because the base URL is the founder's. */
export const queryStats = async (
  network: PlausibleNetwork,
  baseUrl: string,
  apiKey: string,
  query: Readonly<Record<string, unknown>>,
): Promise<Result<StatsRows, StatsFailure>> => {
  const response = await safeRequest(
    new URL("api/v2/query", baseUrl).toString(),
    {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(query),
    },
    httpOptions(network),
  );
  if (!response.ok) return err({ kind: "network", failure: response.error });
  const { status, body } = response.value;
  if (status === 401) return err(unauthorised(body));
  if (status === 404) return err({ kind: "site_not_found" });
  if (status !== 200) return err({ kind: "http", status });
  try {
    const parsed = results.safeParse(JSON.parse(body));
    return parsed.success ? ok(parsed.data.results) : err({ kind: "http", status });
  } catch {
    return err({ kind: "http", status });
  }
};

const DAY = 86_400_000;

/** Plausible takes inclusive dates: a week ending Monday 00:00 ends on Sunday. */
export const dateRangeOf = (from: Date, to: Date) => [
  from.toISOString().slice(0, 10),
  new Date(to.getTime() - DAY).toISOString().slice(0, 10),
];
