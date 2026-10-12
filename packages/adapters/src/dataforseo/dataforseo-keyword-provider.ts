import { err, ok, type Result } from "@launchpilot/domain";
import type { KeywordError, KeywordIdea, KeywordProvider, KeywordQuery } from "@launchpilot/ports";
import { z } from "zod";
import { dataForSeoLocation } from "./locales";

export interface DataForSeoOptions {
  readonly login: string;
  /** The API password from the DataForSEO dashboard. Never logged. */
  readonly password: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

const OK = 20000;

const item = z.object({
  keyword: z.string(),
  keyword_info: z.object({ search_volume: z.number().nullish() }).nullish(),
  keyword_properties: z.object({ keyword_difficulty: z.number().nullish() }).nullish(),
});

const envelope = z.object({
  status_code: z.number(),
  status_message: z.string().default(""),
  tasks: z
    .array(
      z.object({
        status_code: z.number(),
        status_message: z.string().default(""),
        result: z.array(z.object({ items: z.array(item).nullish() })).nullish(),
      }),
    )
    .nullish(),
});

const failure = (code: KeywordError["code"], message: string, retryable: boolean) =>
  err<KeywordError>({ code, message, retryable });

/**
 * DataForSEO reports most failures in the body's `status_code` (HTTP is often 200):
 * 401xx credentials, 402xx balance and limits, other 4xxxx bad requests, 5xxxx outages.
 */
const fromStatus = (status: number, message: string) => {
  if (status >= 50000) return failure("unavailable", `DataForSEO is unavailable: ${message}`, true);
  if (status >= 40200 && status < 40300) {
    return failure("quota_exceeded", `DataForSEO refused the request: ${message}`, false);
  }
  if (status >= 40100 && status < 40200) {
    return failure("invalid_request", "DataForSEO did not accept the API login", false);
  }
  return failure("invalid_request", `DataForSEO rejected the request: ${message}`, false);
};

const toIdea = ({
  keyword,
  keyword_info,
  keyword_properties,
}: z.infer<typeof item>): KeywordIdea => ({
  keyword,
  monthlySearches: keyword_info?.search_volume ?? 0,
  // Unknown difficulty is treated as the hardest, so it never looks like an easy win.
  difficulty: keyword_properties?.keyword_difficulty ?? 100,
});

/** Keyword ideas with search volume and difficulty from DataForSEO Labs (Google data). */
export class DataForSeoKeywordProvider implements KeywordProvider {
  constructor(private readonly options: DataForSeoOptions) {}

  async suggest(query: KeywordQuery): Promise<Result<readonly KeywordIdea[], KeywordError>> {
    const location = dataForSeoLocation(query.locale);
    if (!location) {
      return failure("invalid_request", `Keyword data is not available for ${query.locale}`, false);
    }
    const base = this.options.baseUrl ?? "https://api.dataforseo.com";
    let response: Response;
    try {
      response = await fetch(`${base}/v3/dataforseo_labs/google/keyword_ideas/live`, {
        method: "POST",
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
        headers: {
          authorization: `Basic ${Buffer.from(`${this.options.login}:${this.options.password}`).toString("base64")}`,
          "content-type": "application/json",
        },
        body: JSON.stringify([
          { keywords: query.seeds, ...location, limit: query.limit, include_seed_keyword: true },
        ]),
      });
    } catch {
      return failure("unavailable", "DataForSEO could not be reached", true);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      json = undefined;
    }
    const parsed = envelope.safeParse(json);
    if (!parsed.success) {
      return response.status >= 500 || !response.ok
        ? failure("unavailable", `DataForSEO answered with HTTP ${response.status}`, true)
        : failure("unavailable", "DataForSEO answered in an unexpected format", true);
    }
    const { status_code, status_message, tasks } = parsed.data;
    if (status_code !== OK) return fromStatus(status_code, status_message);
    const task = tasks?.[0];
    if (!task) return failure("unavailable", "DataForSEO returned no task", true);
    if (task.status_code !== OK) return fromStatus(task.status_code, task.status_message);

    const items = task.result?.flatMap((result) => result.items ?? []) ?? [];
    return ok(items.slice(0, query.limit).map(toIdea));
  }
}
