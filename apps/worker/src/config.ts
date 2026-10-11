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
