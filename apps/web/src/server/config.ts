import { rateLimits, type RateLimitPolicy } from "@nuvantre/application";
import { err, ok, type Result } from "@nuvantre/domain";
import { z } from "zod";

const OVERRIDES_MESSAGE = "RATE_LIMIT_OVERRIDES must look like signup=1000,draft=500";

const isPolicy = (name: string): name is RateLimitPolicy => Object.hasOwn(rateLimits, name);

/** "signup=1000,draft=500" → { signup: 1000, draft: 500 }; null when malformed. */
const parseOverrides = (value: string): Partial<Record<RateLimitPolicy, number>> | null => {
  const overrides: Partial<Record<RateLimitPolicy, number>> = {};
  for (const part of value
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p !== "")) {
    const [name = "", limit = ""] = part.split("=").map((p) => p.trim());
    if (!isPolicy(name) || !/^\d+$/.test(limit)) return null;
    overrides[name] = Number(limit);
  }
  return overrides;
};

export type BillingConfig =
  | { readonly provider: "local"; readonly secret: string }
  | { readonly provider: "stripe"; readonly secretKey: string; readonly webhookSecret: string };

export interface ClaudeConfig {
  readonly kind: "claude";
  readonly apiKey: string;
  readonly model: string;
}

export type BriefDrafterConfig = ClaudeConfig | { readonly kind: "extractive" };
export type ArticleWriterConfig = ClaudeConfig | { readonly kind: "template" };
export type KeywordProviderConfig =
  | {
      readonly kind: "dataforseo";
      readonly login: string;
      readonly password: string;
      readonly baseUrl: string | null;
    }
  | { readonly kind: "offline" };

export type SocialWriterConfig = ClaudeConfig | { readonly kind: "template" };
export type LaunchWriterConfig = ClaudeConfig | { readonly kind: "template" };

export type AnalystConfig = ClaudeConfig | { readonly kind: "template" };
export type AutopilotAgentConfig = ClaudeConfig | { readonly kind: "template" };

export interface GoogleConfig {
  readonly clientId: string;
  /** Never logged. */
  readonly clientSecret: string;
  /** Development and test only: one local stand-in for every Google endpoint. */
  readonly baseUrl: string | null;
}

export interface ZernioConfig {
  /** Never logged. */
  readonly apiKey: string;
  readonly baseUrl: string | null;
}

/** Development and test only: local stand-ins for the Webflow and Wix APIs. */
export interface BlogApisConfig {
  readonly webflowApiBaseUrl: string | null;
  readonly wixApiBaseUrl: string | null;
}

export interface HardeningConfig {
  /** Read the client's address from X-Forwarded-For; only behind a proxy that sets it. */
  readonly trustProxy: boolean;
  /** Development and test only: raised limits for named rate-limit policies. */
  readonly rateLimitOverrides: Readonly<Partial<Record<RateLimitPolicy, number>>>;
}

export interface MonitoringConfig {
  /** Null: unexpected errors are logged as scrubbed JSON lines only. */
  readonly sentry: {
    readonly dsn: string;
    readonly environment: string;
    readonly release: string;
  } | null;
}

/** How invitations and reports are emailed: Resend, or (development and test) the log only. */
export type MailConfig =
  | {
      readonly kind: "resend";
      readonly apiKey: string;
      readonly from: string;
      readonly baseUrl?: string;
    }
  | { readonly kind: "log" };

export interface WebConfig {
  readonly databaseUrl: string;
  readonly appUrl: string;
  readonly billing: BillingConfig;
  /** Lets the crawler and publishers reach localhost and LAN sites; development and test only. */
  readonly allowPrivateNetwork: boolean;
  /** Encrypts blog passwords and tokens at rest. */
  readonly tokenEncryptionKey: string;
  readonly blogs: BlogApisConfig;
  readonly hardening: HardeningConfig;
  readonly monitoring: MonitoringConfig;
  readonly mail: MailConfig;
  readonly brief: { readonly drafter: BriefDrafterConfig };
  readonly seo: { readonly keywords: KeywordProviderConfig; readonly writer: ArticleWriterConfig };
  readonly social: { readonly writer: SocialWriterConfig; readonly zernio: ZernioConfig };
  readonly launch: { readonly writer: LaunchWriterConfig };
  /** Google is null when GOOGLE_CLIENT_ID is not set: founders can then connect Plausible only. */
  readonly analytics: { readonly google: GoogleConfig | null; readonly analyst: AnalystConfig };
  readonly autopilot: {
    readonly strategist: AutopilotAgentConfig;
    readonly reviewer: AutopilotAgentConfig;
  };
}

const KEY_MESSAGE =
  "TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)";

const required = (name: string) =>
  z.string({ error: `${name} is required` }).min(1, `${name} is required`);

const shared = {
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is required" })
    .regex(/^postgres(ql)?:\/\/\S+$/, "DATABASE_URL must be a postgres:// URL"),
  APP_URL: z.url({
    error: (issue) =>
      issue.input === undefined ? "APP_URL is required" : "APP_URL must be an absolute URL",
  }),
  APP_ENV: z.enum(["development", "test", "production"]).default("production"),
  TOKEN_ENCRYPTION_KEY: z
    .string({ error: KEY_MESSAGE })
    .refine(
      (value) => /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, "base64").length === 32,
      KEY_MESSAGE,
    ),
  BRIEF_DRAFTER: z.enum(["claude", "extractive"]).default("claude"),
  ARTICLE_WRITER: z.enum(["claude", "template"]).default("claude"),
  KEYWORD_PROVIDER: z.enum(["dataforseo", "offline"]).default("dataforseo"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z
    .string()
    .regex(/^claude-[a-z0-9.-]+$/, "ANTHROPIC_MODEL must be a Claude model id")
    .default("claude-opus-5-5"),
  DATAFORSEO_LOGIN: z.string().min(1).optional(),
  DATAFORSEO_PASSWORD: z.string().min(1).optional(),
  DATAFORSEO_BASE_URL: z.url("DATAFORSEO_BASE_URL must be an absolute URL").optional(),
  ALLOW_PRIVATE_NETWORK: z.enum(["true", "false"]).default("false"),
  WEBFLOW_API_BASE_URL: z.url("WEBFLOW_API_BASE_URL must be an absolute URL").optional(),
  WIX_API_BASE_URL: z.url("WIX_API_BASE_URL must be an absolute URL").optional(),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  RATE_LIMIT_OVERRIDES: z
    .string()
    .optional()
    .refine((value) => value === undefined || parseOverrides(value) !== null, OVERRIDES_MESSAGE),
  SENTRY_DSN: z.url("SENTRY_DSN must be a Sentry DSN URL").optional(),
  MAILER: z.enum(["resend", "log"]).default("resend"),
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().optional(),
  RESEND_BASE_URL: z.url("RESEND_BASE_URL must be an absolute URL").optional(),
  APP_VERSION: z.string().min(1).default("0.1.0"),
  SOCIAL_WRITER: z.enum(["claude", "template"]).default("claude"),
  LAUNCH_WRITER: z.enum(["claude", "template"]).default("claude"),
  ZERNIO_API_KEY: required("ZERNIO_API_KEY"),
  ZERNIO_BASE_URL: z.url("ZERNIO_BASE_URL must be an absolute URL").optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_API_BASE_URL: z.url("GOOGLE_API_BASE_URL must be an absolute URL").optional(),
  ANALYST: z.enum(["claude", "template"]).default("claude"),
  STRATEGIST: z.enum(["claude", "template"]).default("claude"),
  REVIEWER: z.enum(["claude", "template"]).default("claude"),
};

const schema = z.discriminatedUnion("BILLING_PROVIDER", [
  z.object({
    ...shared,
    BILLING_PROVIDER: z.literal("local"),
    LOCAL_BILLING_SECRET: z.string().min(16, "LOCAL_BILLING_SECRET must be at least 16 characters"),
  }),
  z.object({
    ...shared,
    BILLING_PROVIDER: z.literal("stripe"),
    STRIPE_SECRET_KEY: z
      .string()
      .regex(/^(sk|rk)_(test|live)_\S+$/, "STRIPE_SECRET_KEY must be a secret key"),
    STRIPE_WEBHOOK_SECRET: z
      .string()
      .startsWith("whsec_", "STRIPE_WEBHOOK_SECRET must start with whsec_"),
  }),
]);

type Env = z.infer<typeof schema>;

/** Settings that stand in for real services; production must never fall back to them silently. */
const devOnlySettings: readonly [string, (c: Env) => boolean][] = [
  ["BILLING_PROVIDER=local", (c) => c.BILLING_PROVIDER === "local"],
  ["BRIEF_DRAFTER=extractive", (c) => c.BRIEF_DRAFTER === "extractive"],
  ["ARTICLE_WRITER=template", (c) => c.ARTICLE_WRITER === "template"],
  ["KEYWORD_PROVIDER=offline", (c) => c.KEYWORD_PROVIDER === "offline"],
  ["SOCIAL_WRITER=template", (c) => c.SOCIAL_WRITER === "template"],
  ["LAUNCH_WRITER=template", (c) => c.LAUNCH_WRITER === "template"],
  ["ANALYST=template", (c) => c.ANALYST === "template"],
  ["STRATEGIST=template", (c) => c.STRATEGIST === "template"],
  ["REVIEWER=template", (c) => c.REVIEWER === "template"],
  ["GOOGLE_API_BASE_URL", (c) => c.GOOGLE_API_BASE_URL !== undefined],
  ["ALLOW_PRIVATE_NETWORK", (c) => c.ALLOW_PRIVATE_NETWORK === "true"],
  ["WEBFLOW_API_BASE_URL", (c) => c.WEBFLOW_API_BASE_URL !== undefined],
  ["WIX_API_BASE_URL", (c) => c.WIX_API_BASE_URL !== undefined],
  ["RATE_LIMIT_OVERRIDES", (c) => c.RATE_LIMIT_OVERRIDES !== undefined],
];

const claude = (c: Env): ClaudeConfig | undefined =>
  c.ANTHROPIC_API_KEY === undefined
    ? undefined
    : { kind: "claude", apiKey: c.ANTHROPIC_API_KEY, model: c.ANTHROPIC_MODEL };

const keywordsFor = (c: Env): KeywordProviderConfig | undefined => {
  if (c.KEYWORD_PROVIDER === "offline") return { kind: "offline" };
  if (c.DATAFORSEO_LOGIN === undefined || c.DATAFORSEO_PASSWORD === undefined) return undefined;
  return {
    kind: "dataforseo",
    login: c.DATAFORSEO_LOGIN,
    password: c.DATAFORSEO_PASSWORD,
    baseUrl: c.DATAFORSEO_BASE_URL ?? null,
  };
};

/** Validates the web app's environment once, at the edge. APP_ENV defaults to production. */
const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** The mail settings, or why they are unusable. */
const mailFor = (c: {
  MAILER: "resend" | "log";
  RESEND_API_KEY?: string | undefined;
  MAIL_FROM?: string | undefined;
  RESEND_BASE_URL?: string | undefined;
  APP_ENV: "development" | "test" | "production";
}): MailConfig | string => {
  if ((c.MAILER === "log" || c.RESEND_BASE_URL !== undefined) && c.APP_ENV === "production") {
    return "MAILER=log and RESEND_BASE_URL are for development and test only";
  }
  if (c.MAILER === "log") return { kind: "log" };
  if (c.RESEND_API_KEY === undefined) return "RESEND_API_KEY is required to send email";
  if (c.MAIL_FROM === undefined || !ADDRESS.test(c.MAIL_FROM)) {
    return "MAIL_FROM must be an address on a domain verified in Resend";
  }
  return {
    kind: "resend",
    apiKey: c.RESEND_API_KEY,
    from: c.MAIL_FROM,
    ...(c.RESEND_BASE_URL === undefined ? {} : { baseUrl: c.RESEND_BASE_URL }),
  };
};

export const parseWebConfig = (
  env: Readonly<Record<string, string | undefined>>,
): Result<WebConfig, string> => {
  const parsed = schema.safeParse(env);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid configuration");
  const c = parsed.data;

  if (c.APP_ENV === "production") {
    const refused = devOnlySettings.find(([, applies]) => applies(c));
    if (refused) return err(`${refused[0]} is only allowed when APP_ENV is development or test`);
  }
  const ai = claude(c);
  const needsClaude =
    c.BRIEF_DRAFTER === "claude" ||
    c.ARTICLE_WRITER === "claude" ||
    c.SOCIAL_WRITER === "claude" ||
    c.LAUNCH_WRITER === "claude" ||
    c.ANALYST === "claude" ||
    c.STRATEGIST === "claude" ||
    c.REVIEWER === "claude";
  if (needsClaude && !ai) {
    return err(
      "ANTHROPIC_API_KEY is required when BRIEF_DRAFTER, ARTICLE_WRITER, SOCIAL_WRITER, LAUNCH_WRITER, ANALYST, STRATEGIST or REVIEWER is claude",
    );
  }
  if ((c.GOOGLE_CLIENT_ID === undefined) !== (c.GOOGLE_CLIENT_SECRET === undefined)) {
    return err("Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither");
  }
  const mail = mailFor(c);
  if (typeof mail === "string") return err(mail);
  const keywords = keywordsFor(c);
  if (!keywords) {
    return err(
      "DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are required when KEYWORD_PROVIDER is dataforseo",
    );
  }

  return ok({
    databaseUrl: c.DATABASE_URL,
    appUrl: c.APP_URL.replace(/\/$/, ""),
    billing:
      c.BILLING_PROVIDER === "local"
        ? { provider: "local", secret: c.LOCAL_BILLING_SECRET }
        : {
            provider: "stripe",
            secretKey: c.STRIPE_SECRET_KEY,
            webhookSecret: c.STRIPE_WEBHOOK_SECRET,
          },
    allowPrivateNetwork: c.ALLOW_PRIVATE_NETWORK === "true",
    tokenEncryptionKey: c.TOKEN_ENCRYPTION_KEY,
    blogs: {
      webflowApiBaseUrl: c.WEBFLOW_API_BASE_URL ?? null,
      wixApiBaseUrl: c.WIX_API_BASE_URL ?? null,
    },
    hardening: {
      trustProxy: c.TRUST_PROXY === "true",
      rateLimitOverrides: parseOverrides(c.RATE_LIMIT_OVERRIDES ?? "") ?? {},
    },
    mail,
    monitoring: {
      sentry:
        c.SENTRY_DSN === undefined
          ? null
          : { dsn: c.SENTRY_DSN, environment: c.APP_ENV, release: c.APP_VERSION },
    },
    brief: { drafter: c.BRIEF_DRAFTER === "claude" && ai ? ai : { kind: "extractive" } },
    seo: { keywords, writer: c.ARTICLE_WRITER === "claude" && ai ? ai : { kind: "template" } },
    social: {
      writer: c.SOCIAL_WRITER === "claude" && ai ? ai : { kind: "template" },
      zernio: { apiKey: c.ZERNIO_API_KEY, baseUrl: c.ZERNIO_BASE_URL ?? null },
    },
    launch: { writer: c.LAUNCH_WRITER === "claude" && ai ? ai : { kind: "template" } },
    analytics: {
      google:
        c.GOOGLE_CLIENT_ID === undefined || c.GOOGLE_CLIENT_SECRET === undefined
          ? null
          : {
              clientId: c.GOOGLE_CLIENT_ID,
              clientSecret: c.GOOGLE_CLIENT_SECRET,
              baseUrl: c.GOOGLE_API_BASE_URL ?? null,
            },
      analyst: c.ANALYST === "claude" && ai ? ai : { kind: "template" },
    },
    autopilot: {
      strategist: c.STRATEGIST === "claude" && ai ? ai : { kind: "template" },
      reviewer: c.REVIEWER === "claude" && ai ? ai : { kind: "template" },
    },
  });
};
