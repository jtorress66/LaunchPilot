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

/** A textarea holding one item per line; blank lines are ignored. */
const lines = (maxItems: number, maxLength: number) =>
  z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== ""),
    )
    .refine(
      (items) => items.every((item) => item.length <= maxLength),
      `Keep each line under ${maxLength} characters`,
    )
    .refine((items) => items.length <= maxItems, `Use at most ${maxItems} lines`);

export const briefForm = z.object({
  audience: text("Describe who the product is for", 2000),
  problem: text("Describe the problem it solves", 2000),
  solution: text("Describe how it solves it", 2000),
  tone: text("Describe the tone of voice", 2000),
  differentiators: lines(20, 500),
  facts: lines(20, 500),
});

export const blogConnectionForm = z.object({
  siteUrl: text("Enter your blog's address", 2048),
  username: text("Enter your WordPress username", 200),
  secret: text("Enter an Application Password", 200),
});

export const seedKeywordsForm = z.object({
  seeds: lines(5, 80).refine((items) => items.length > 0, "Enter at least one topic"),
});

export const articleForm = z.object({
  title: text("Enter a title", 200),
  body: text("The article needs a body", 100_000),
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
