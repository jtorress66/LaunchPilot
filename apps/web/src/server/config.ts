import { err, ok, type Result } from "@launchpilot/domain";
import { z } from "zod";

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

export interface ZernioConfig {
  /** Never logged. */
  readonly apiKey: string;
  readonly baseUrl: string | null;
}

export interface WebConfig {
  readonly databaseUrl: string;
  readonly appUrl: string;
  readonly billing: BillingConfig;
  /** Lets the crawler and publishers reach localhost and LAN sites; development and test only. */
  readonly allowPrivateNetwork: boolean;
  /** Encrypts blog passwords and tokens at rest. */
  readonly tokenEncryptionKey: string;
  readonly brief: { readonly drafter: BriefDrafterConfig };
  readonly seo: { readonly keywords: KeywordProviderConfig; readonly writer: ArticleWriterConfig };
  readonly social: { readonly writer: SocialWriterConfig; readonly zernio: ZernioConfig };
  readonly launch: { readonly writer: LaunchWriterConfig };
}

const KEY_MESSAGE =
  "TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)";

const required = (name: string) =>
  z.string({ required_error: `${name} is required` }).min(1, `${name} is required`);

const shared = {
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .regex(/^postgres(ql)?:\/\/\S+$/, "DATABASE_URL must be a postgres:// URL"),
  APP_URL: z
    .string({ required_error: "APP_URL is required" })
    .url("APP_URL must be an absolute URL"),
  APP_ENV: z.enum(["development", "test", "production"]).default("production"),
  TOKEN_ENCRYPTION_KEY: z
    .string({ required_error: KEY_MESSAGE })
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
  DATAFORSEO_BASE_URL: z.string().url("DATAFORSEO_BASE_URL must be an absolute URL").optional(),
  ALLOW_PRIVATE_NETWORK: z.enum(["true", "false"]).default("false"),
  SOCIAL_WRITER: z.enum(["claude", "template"]).default("claude"),
  LAUNCH_WRITER: z.enum(["claude", "template"]).default("claude"),
  ZERNIO_API_KEY: required("ZERNIO_API_KEY"),
  ZERNIO_BASE_URL: z.string().url("ZERNIO_BASE_URL must be an absolute URL").optional(),
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
  ["ALLOW_PRIVATE_NETWORK", (c) => c.ALLOW_PRIVATE_NETWORK === "true"],
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
    c.LAUNCH_WRITER === "claude";
  if (needsClaude && !ai) {
    return err(
      "ANTHROPIC_API_KEY is required when BRIEF_DRAFTER, ARTICLE_WRITER, SOCIAL_WRITER or LAUNCH_WRITER is claude",
    );
  }
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
    brief: { drafter: c.BRIEF_DRAFTER === "claude" && ai ? ai : { kind: "extractive" } },
    seo: { keywords, writer: c.ARTICLE_WRITER === "claude" && ai ? ai : { kind: "template" } },
    social: {
      writer: c.SOCIAL_WRITER === "claude" && ai ? ai : { kind: "template" },
      zernio: { apiKey: c.ZERNIO_API_KEY, baseUrl: c.ZERNIO_BASE_URL ?? null },
    },
    launch: { writer: c.LAUNCH_WRITER === "claude" && ai ? ai : { kind: "template" } },
  });
};
