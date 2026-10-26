import { err, ok, type Result } from "@nuvantre/domain";
import { z } from "zod";
import { channelNames } from "./api";

/** The Zernio operations Nuvantre calls; a change to any of them is worth a look. */
const OPERATIONS_WE_CALL: readonly string[] = [
  "POST /v1/profiles",
  "GET /v1/profiles",
  "GET /v1/connect/{platform}",
  "GET /v1/accounts",
  "POST /v1/posts",
];

/** Response schemas the adapter parses; removing one breaks it. */
const SCHEMAS_WE_READ: readonly string[] = [
  "Profile",
  "ProfileCreateResponse",
  "ProfilesListResponse",
  "AccountsListResponse",
  "SocialAccount",
  "Post",
  "PlatformTarget",
  "PostCreateResponse",
  "PostPublishIncompleteResponse",
  "ErrorResponse",
];

/** The changelog's platform slugs for the channels Nuvantre publishes to. */
const OUR_PLATFORMS = { x: channelNames.x, linkedin: channelNames.linkedin } as const;

const operation = z.object({ method: z.string(), path: z.string() });

const entrySchema = z.object({
  id: z.string(),
  type: z.string(),
  impact: z.string().nullable(),
  platforms: z.array(z.string()),
  message: z.string(),
  publishedAt: z.string(),
  specVersion: z.string().nullable(),
  url: z.string(),
  changes: z.object({
    endpoints: z.object({
      added: z.array(operation),
      removed: z.array(operation),
      modified: z.array(operation),
    }),
    schemas: z.object({
      added: z.array(z.string()),
      removed: z.array(z.string()),
      modified: z.array(z.string()),
    }),
  }),
});

const pageSchema = z.object({ entries: z.array(entrySchema), nextCursor: z.string().nullable() });

export type ZernioChangelogEntry = z.infer<typeof entrySchema>;

export interface ZernioChangeAssessment {
  readonly affected: boolean;
  /** Why the entry matters to Nuvantre, one line each. */
  readonly reasons: readonly string[];
}

const opKey = ({ method, path }: { method: string; path: string }) =>
  `${method.toUpperCase()} ${path.replace(/^\/api(?=\/v\d)/, "")}`;

/** Whether a changelog entry touches what Nuvantre calls, reads or publishes to. */
export const assessZernioChange = (entry: ZernioChangelogEntry): ZernioChangeAssessment => {
  const { endpoints, schemas } = entry.changes;
  const touched = (ops: readonly { method: string; path: string }[]) =>
    ops.map(opKey).filter((key) => OPERATIONS_WE_CALL.includes(key));
  const ours = (Object.keys(OUR_PLATFORMS) as (keyof typeof OUR_PLATFORMS)[]).filter((slug) =>
    entry.platforms.includes(slug),
  );
  const actionRequired = entry.impact === "action_required" || entry.type === "breaking_change";

  const reasons = [
    ...touched(endpoints.removed).map((op) => `Removes ${op}, which Nuvantre calls`),
    ...touched(endpoints.modified).map((op) => `Changes ${op}, which Nuvantre calls`),
    ...schemas.removed
      .filter((name) => SCHEMAS_WE_READ.includes(name))
      .map((name) => `Removes the ${name} schema, which Nuvantre reads`),
    ...(actionRequired ? ours.map((slug) => `Needs action on ${OUR_PLATFORMS[slug]}`) : []),
    ...(entry.type === "deprecation"
      ? ours.map((slug) => `Deprecates something on ${OUR_PLATFORMS[slug]}`)
      : []),
  ];
  // A breaking change that names no platform applies to every integration.
  if (reasons.length === 0 && actionRequired && entry.platforms.length === 0) {
    reasons.push("Breaking change for every integration");
  }
  return { affected: reasons.length > 0, reasons };
};

const MAX_PAGES = 10;

/**
 * Entries of Zernio's public API changelog published at or after `since`, newest first.
 * The changelog needs no API key; it is the same feed the `api.changelog.published` webhook sends.
 */
export const fetchZernioChangelog = async ({
  since,
  baseUrl = "https://zernio.com/api",
  timeoutMs = 30_000,
}: {
  since: Date;
  baseUrl?: string;
  timeoutMs?: number;
}): Promise<Result<ZernioChangelogEntry[], string>> => {
  const entries: ZernioChangelogEntry[] = [];
  let before: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(`${baseUrl}/v1/changelog`);
    url.searchParams.set("limit", "50");
    if (before !== null) url.searchParams.set("before", before);
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      return err("Zernio's changelog could not be reached");
    }
    if (!response.ok) return err(`Zernio's changelog answered HTTP ${String(response.status)}`);
    const parsed = pageSchema.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) return err("Zernio's changelog answered in an unexpected format");
    const recent = parsed.data.entries.filter((e) => Date.parse(e.publishedAt) >= since.getTime());
    entries.push(...recent);
    before = parsed.data.nextCursor;
    if (before === null || recent.length < parsed.data.entries.length) break;
  }
  return ok(entries);
};
