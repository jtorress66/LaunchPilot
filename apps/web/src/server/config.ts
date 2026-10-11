import { err, ok, type Result } from "@launchpilot/domain";
import { z } from "zod";

export type BillingConfig =
  | { readonly provider: "local"; readonly secret: string }
  | { readonly provider: "stripe"; readonly secretKey: string; readonly webhookSecret: string };

export interface WebConfig {
  readonly databaseUrl: string;
  readonly appUrl: string;
  readonly billing: BillingConfig;
}

const shared = {
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .regex(/^postgres(ql)?:\/\/\S+$/, "DATABASE_URL must be a postgres:// URL"),
  APP_URL: z
    .string({ required_error: "APP_URL is required" })
    .url("APP_URL must be an absolute URL"),
  APP_ENV: z.enum(["development", "test", "production"]).default("production"),
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

/** Validates the web app's environment once, at the edge. APP_ENV defaults to production. */
export const parseWebConfig = (
  env: Readonly<Record<string, string | undefined>>,
): Result<WebConfig, string> => {
  const parsed = schema.safeParse(env);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid configuration");
  const c = parsed.data;
  if (c.BILLING_PROVIDER === "local" && c.APP_ENV === "production") {
    return err("BILLING_PROVIDER=local is only allowed when APP_ENV is development or test");
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
  });
};
