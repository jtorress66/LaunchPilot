import { err, ok, type Result } from "@launchpilot/domain";
import { z } from "zod";

export interface DatabaseConfig {
  readonly connectionString: string;
}

const schema = z.object({
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .refine((value) => /^postgres(ql)?:\/\/\S+$/.test(value), {
      message: "DATABASE_URL must be a postgres:// or postgresql:// URL",
    }),
});

/** Validates environment input at the edge, before anything touches the database. */
export const parseDatabaseConfig = (
  env: Readonly<Record<string, string | undefined>>,
): Result<DatabaseConfig, string> => {
  const parsed = schema.safeParse(env);
  if (!parsed.success)
    return err(parsed.error.issues[0]?.message ?? "Invalid database configuration");
  return ok({ connectionString: parsed.data.DATABASE_URL });
};

export interface StripeSetupConfig {
  readonly secretKey: string;
}

/** `pnpm stripe:setup` works in test mode unless the operator explicitly passes --live. */
export const parseStripeSetupConfig = (
  env: Readonly<Record<string, string | undefined>>,
  argv: readonly string[],
): Result<StripeSetupConfig, string> => {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return err("STRIPE_SECRET_KEY is required");
  if (key.includes("_live_") && !argv.includes("--live")) {
    return err("Refusing to use a live Stripe key. Pass --live if you really mean it.");
  }
  return ok({ secretKey: key });
};

export interface ZernioConfig {
  /** Never logged. */
  readonly apiKey: string;
  readonly baseUrl: string | null;
}

export interface PublisherConfig {
  readonly connectionString: string;
  readonly tokenEncryptionKey: string;
  /** Lets the WordPress publisher reach localhost and LAN blogs; development and test only. */
  readonly allowPrivateNetwork: boolean;
  readonly intervalMs: number;
  readonly zernio: ZernioConfig;
}

const KEY_MESSAGE =
  "TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)";

const zernioKey = z
  .string({ required_error: "ZERNIO_API_KEY is required" })
  .min(1, "ZERNIO_API_KEY is required");
const zernioBaseUrl = z.string().url("ZERNIO_BASE_URL must be an absolute URL").optional();

const publisherSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("production"),
  TOKEN_ENCRYPTION_KEY: z
    .string({ required_error: KEY_MESSAGE })
    .refine(
      (value) => /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, "base64").length === 32,
      KEY_MESSAGE,
    ),
  ALLOW_PRIVATE_NETWORK: z.enum(["true", "false"]).default("false"),
  PUBLISH_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(5_000, "PUBLISH_INTERVAL_MS must be at least 5000")
    .default(60_000),
  ZERNIO_API_KEY: zernioKey,
  ZERNIO_BASE_URL: zernioBaseUrl,
});

/** Everything the scheduled publish job needs, validated before it touches the database. */
export const parsePublisherConfig = (
  env: Readonly<Record<string, string | undefined>>,
): Result<PublisherConfig, string> => {
  const database = parseDatabaseConfig(env);
  if (!database.ok) return database;
  const parsed = publisherSchema.safeParse(env);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid configuration");
  const c = parsed.data;
  if (c.APP_ENV === "production" && c.ALLOW_PRIVATE_NETWORK === "true") {
    return err("ALLOW_PRIVATE_NETWORK is only allowed when APP_ENV is development or test");
  }
  return ok({
    connectionString: database.value.connectionString,
    tokenEncryptionKey: c.TOKEN_ENCRYPTION_KEY,
    allowPrivateNetwork: c.ALLOW_PRIVATE_NETWORK === "true",
    intervalMs: c.PUBLISH_INTERVAL_MS,
    zernio: { apiKey: c.ZERNIO_API_KEY, baseUrl: c.ZERNIO_BASE_URL ?? null },
  });
};

export type AnalystConfig =
  | { readonly kind: "claude"; readonly apiKey: string; readonly model: string | null }
  | { readonly kind: "template" };

export interface GoogleConfig {
  readonly clientId: string;
  /** Never logged. */
  readonly clientSecret: string;
  /** Development and test only: one local stand-in for every Google endpoint. */
  readonly baseUrl: string | null;
}

export interface ReportsConfig {
  readonly intervalMs: number;
  /** Null when Google is not configured: reports then read Plausible only. */
  readonly google: GoogleConfig | null;
  readonly analyst: AnalystConfig;
}

const reportsSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("production"),
  REPORT_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(60_000, "REPORT_INTERVAL_MS must be at least 60000")
    .default(3_600_000),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_API_BASE_URL: z.string().url("GOOGLE_API_BASE_URL must be an absolute URL").optional(),
  ANALYST: z.enum(["claude", "template"]).default("claude"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z
    .string()
    .regex(/^claude-[a-z0-9.-]+$/, "ANTHROPIC_MODEL must be a Claude model id")
    .optional(),
});

/** What the weekly report job needs, validated before it reads any analytics. */
export const parseReportsConfig = (
  env: Readonly<Record<string, string | undefined>>,
): Result<ReportsConfig, string> => {
  const parsed = reportsSchema.safeParse(env);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid configuration");
  const c = parsed.data;
  const production = c.APP_ENV === "production";
  if ((c.GOOGLE_CLIENT_ID === undefined) !== (c.GOOGLE_CLIENT_SECRET === undefined)) {
    return err("Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither");
  }
  if (production && c.GOOGLE_API_BASE_URL !== undefined) {
    return err("GOOGLE_API_BASE_URL is only allowed when APP_ENV is development or test");
  }
  if (production && c.ANALYST === "template") {
    return err("ANALYST=template is only allowed when APP_ENV is development or test");
  }
  if (c.ANALYST === "claude" && c.ANTHROPIC_API_KEY === undefined) {
    return err("ANTHROPIC_API_KEY is required when ANALYST is claude");
  }
  return ok({
    intervalMs: c.REPORT_INTERVAL_MS,
    google:
      c.GOOGLE_CLIENT_ID === undefined || c.GOOGLE_CLIENT_SECRET === undefined
        ? null
        : {
            clientId: c.GOOGLE_CLIENT_ID,
            clientSecret: c.GOOGLE_CLIENT_SECRET,
            baseUrl: c.GOOGLE_API_BASE_URL ?? null,
          },
    analyst:
      c.ANALYST === "claude" && c.ANTHROPIC_API_KEY !== undefined
        ? { kind: "claude", apiKey: c.ANTHROPIC_API_KEY, model: c.ANTHROPIC_MODEL ?? null }
        : { kind: "template" },
  });
};

export type AgentChoice = "claude" | "template";

export type LoopKeywordsConfig =
  | {
      readonly kind: "dataforseo";
      readonly login: string;
      /** Never logged. */
      readonly password: string;
      readonly baseUrl: string | null;
    }
  | { readonly kind: "offline" };

export interface LoopConfig {
  readonly intervalMs: number;
  /** Null when no agent uses Claude. */
  readonly claude: { readonly apiKey: string; readonly model: string | null } | null;
  readonly agents: {
    readonly strategist: AgentChoice;
    readonly reviewer: AgentChoice;
    readonly articleWriter: AgentChoice;
    readonly socialWriter: AgentChoice;
  };
  readonly keywords: LoopKeywordsConfig;
}

const agentChoice = z.enum(["claude", "template"]).default("claude");

const loopSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("production"),
  LOOP_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(60_000, "LOOP_INTERVAL_MS must be at least 60000")
    .default(3_600_000),
  STRATEGIST: agentChoice,
  REVIEWER: agentChoice,
  ARTICLE_WRITER: agentChoice,
  SOCIAL_WRITER: agentChoice,
  KEYWORD_PROVIDER: z.enum(["dataforseo", "offline"]).default("dataforseo"),
  DATAFORSEO_LOGIN: z.string().min(1).optional(),
  DATAFORSEO_PASSWORD: z.string().min(1).optional(),
  DATAFORSEO_BASE_URL: z.string().url("DATAFORSEO_BASE_URL must be an absolute URL").optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z
    .string()
    .regex(/^claude-[a-z0-9.-]+$/, "ANTHROPIC_MODEL must be a Claude model id")
    .optional(),
});

type LoopEnv = z.infer<typeof loopSchema>;

/** Stand-ins for real services; production must never fall back to them silently. */
const loopDevOnly: readonly [string, (c: LoopEnv) => boolean][] = [
  ["STRATEGIST=template", (c) => c.STRATEGIST === "template"],
  ["REVIEWER=template", (c) => c.REVIEWER === "template"],
  ["ARTICLE_WRITER=template", (c) => c.ARTICLE_WRITER === "template"],
  ["SOCIAL_WRITER=template", (c) => c.SOCIAL_WRITER === "template"],
  ["KEYWORD_PROVIDER=offline", (c) => c.KEYWORD_PROVIDER === "offline"],
];

/** What the weekly loop job needs: its agents, the keyword source and the schedule. */
export const parseLoopConfig = (
  env: Readonly<Record<string, string | undefined>>,
): Result<LoopConfig, string> => {
  const parsed = loopSchema.safeParse(env);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid configuration");
  const c = parsed.data;
  if (c.APP_ENV === "production") {
    const refused = loopDevOnly.find(([, applies]) => applies(c));
    if (refused) return err(`${refused[0]} is only allowed when APP_ENV is development or test`);
  }
  const agents = {
    strategist: c.STRATEGIST,
    reviewer: c.REVIEWER,
    articleWriter: c.ARTICLE_WRITER,
    socialWriter: c.SOCIAL_WRITER,
  };
  const needsClaude = Object.values(agents).includes("claude");
  if (needsClaude && c.ANTHROPIC_API_KEY === undefined) {
    return err("ANTHROPIC_API_KEY is required when an agent uses Claude");
  }
  if (c.KEYWORD_PROVIDER === "dataforseo" && (!c.DATAFORSEO_LOGIN || !c.DATAFORSEO_PASSWORD)) {
    return err(
      "DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are required when KEYWORD_PROVIDER is dataforseo",
    );
  }
  return ok({
    intervalMs: c.LOOP_INTERVAL_MS,
    claude:
      needsClaude && c.ANTHROPIC_API_KEY !== undefined
        ? { apiKey: c.ANTHROPIC_API_KEY, model: c.ANTHROPIC_MODEL ?? null }
        : null,
    agents,
    keywords:
      c.KEYWORD_PROVIDER === "dataforseo" && c.DATAFORSEO_LOGIN && c.DATAFORSEO_PASSWORD
        ? {
            kind: "dataforseo",
            login: c.DATAFORSEO_LOGIN,
            password: c.DATAFORSEO_PASSWORD,
            baseUrl: c.DATAFORSEO_BASE_URL ?? null,
          }
        : { kind: "offline" },
  });
};
