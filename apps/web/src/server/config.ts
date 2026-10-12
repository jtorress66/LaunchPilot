import { err, ok, type Result } from "@launchpilot/domain";
import { z } from "zod";

export type BillingConfig =
  | { readonly provider: "local"; readonly secret: string }
  | { readonly provider: "stripe"; readonly secretKey: string; readonly webhookSecret: string };

export type BriefDrafterConfig =
  | { readonly kind: "claude"; readonly apiKey: string; readonly model: string }
  | { readonly kind: "extractive" };

export interface BriefConfig {
  readonly drafter: BriefDrafterConfig;
  /** Lets the crawler reach localhost and LAN sites; development and test only. */
  readonly allowPrivateNetwork: boolean;
}

export interface WebConfig {
  readonly databaseUrl: string;
  readonly appUrl: string;
  readonly billing: BillingConfig;
  readonly brief: BriefConfig;
}

const shared = {
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .regex(/^postgres(ql)?:\/\/\S+$/, "DATABASE_URL must be a postgres:// URL"),
  APP_URL: z
    .string({ required_error: "APP_URL is required" })
    .url("APP_URL must be an absolute URL"),
  APP_ENV: z.enum(["development", "test", "production"]).default("production"),
  BRIEF_DRAFTER: z.enum(["claude", "extractive"]).default("claude"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z
    .string()
    .regex(/^claude-[a-z0-9.-]+$/, "ANTHROPIC_MODEL must be a Claude model id")
    .default("claude-opus-5-5"),
  CRAWLER_ALLOW_PRIVATE_NETWORK: z.enum(["true", "false"]).default("false"),
};

const devOnly = (setting: string) =>
  `${setting} is only allowed when APP_ENV is development or test`;

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

/** Validates the web app's environment once, at the edge. APP_ENV defaults to production. */
export const parseWebConfig = (
  env: Readonly<Record<string, string | undefined>>,
): Result<WebConfig, string> => {
  const parsed = schema.safeParse(env);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid configuration");
  const c = parsed.data;
  const production = c.APP_ENV === "production";
  if (c.BILLING_PROVIDER === "local" && production) return err(devOnly("BILLING_PROVIDER=local"));
  if (c.BRIEF_DRAFTER === "extractive" && production) {
    return err(devOnly("BRIEF_DRAFTER=extractive"));
  }
  if (c.CRAWLER_ALLOW_PRIVATE_NETWORK === "true" && production) {
    return err(devOnly("CRAWLER_ALLOW_PRIVATE_NETWORK"));
  }
  if (c.BRIEF_DRAFTER === "claude" && c.ANTHROPIC_API_KEY === undefined) {
    return err("ANTHROPIC_API_KEY is required when BRIEF_DRAFTER is claude");
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
    brief: {
      drafter:
        c.BRIEF_DRAFTER === "claude" && c.ANTHROPIC_API_KEY !== undefined
          ? { kind: "claude", apiKey: c.ANTHROPIC_API_KEY, model: c.ANTHROPIC_MODEL }
          : { kind: "extractive" },
      allowPrivateNetwork: c.CRAWLER_ALLOW_PRIVATE_NETWORK === "true",
    },
  });
};
