import { err, ok, type Result } from "@launchpilot/domain";
import { z } from "zod";

const text = (required: string, max: number) =>
  z
    .string()
    .default("")
    .refine((value) => value.trim() !== "", required)
    .refine((value) => value.length <= max, `Use at most ${max} characters`);

export const signUpForm = z.object({
  email: text("Enter your email address", 254),
  password: text("Enter a password", 200),
});

export const logInForm = z.object({
  email: text("Enter your email address", 254),
  password: text("Enter your password", 200),
});

export const productForm = z.object({
  name: text("Enter a product name", 100),
  url: text("Enter your product's website", 2048),
});

export const upgradeForm = z.object({ plan: z.enum(["starter", "growth"]) });

export type FieldErrors = Partial<Record<string, string>>;

/** Edge validation for Server Actions: shape and size only; the domain checks meaning. */
export const parseForm = <T extends z.ZodTypeAny>(
  schema: T,
  data: FormData,
): Result<z.infer<T>, FieldErrors> => {
  const raw = Object.fromEntries(
    [...data.entries()].filter(([, value]) => typeof value === "string"),
  );
  const parsed = schema.safeParse(raw);
  if (parsed.success) return ok(parsed.data as z.infer<T>);
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return err(errors);
};
