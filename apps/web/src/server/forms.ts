import {
  blogPlatformIds,
  blogPlatforms,
  err,
  ok,
  type BlogPlatform,
  type Result,
} from "@nuvantre/domain";
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

export const blogPlatformForm = z.object({
  platform: z.enum(blogPlatformIds, { error: "Choose the platform your blog runs on" }),
});

const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;

/** The connect form for one platform, built from its row in the domain's platform table. */
export const blogConnectionFormFor = (platform: BlogPlatform) => {
  const { fields, secret } = blogPlatforms[platform];
  const settings = z.object(
    Object.fromEntries(fields.map((field) => [field.key, text(`Enter your ${field.label}`, 500)])),
  );
  return z
    .object({
      siteUrl: text("Enter your blog's address", 2048),
      secret: text(`Enter ${withArticle(secret.label)}`, 4000),
    })
    .and(settings)
    .transform(({ siteUrl, secret: key, ...values }) => ({
      platform,
      siteUrl,
      settings: Object.fromEntries(
        fields.map((field) => [field.key, (values[field.key] ?? "").trim()]),
      ),
      secret: key,
    }));
};

/** "Make active": the active product that is paused in its place. */
export const swapProductForm = z.object({
  pause: z
    .string()
    .default("")
    .refine((value) => /^[\w-]{1,100}$/.test(value), "Choose which product to pause"),
});

export const seedKeywordsForm = z.object({
  seeds: lines(5, 80).refine((items) => items.length > 0, "Enter at least one topic"),
});

/** An empty select or input means "none". */
const optional = (max: number) =>
  z
    .string()
    .max(max, `Use at most ${max} characters`)
    .default("")
    .transform((value) => (value.trim() === "" ? null : value.trim()));

export const articleForm = z
  .object({
    title: text("Enter a title", 200),
    body: text("The article needs a body", 100_000),
    slug: optional(75),
    excerpt: optional(300),
  })
  .transform(({ slug, excerpt, ...rest }) => ({
    ...rest,
    // A blank field keeps the article's current value.
    ...(slug === null ? {} : { slug }),
    ...(excerpt === null ? {} : { excerpt }),
  }));

/** The language and market selects; the domain checks the combination. */
export const localeForm = z
  .object({
    language: text("Choose a language", 3),
    market: text("Choose a market", 2),
  })
  .transform(({ language, market }) => ({ locale: `${language}-${market}` }));

export const upgradeForm = z.object({ plan: z.enum(["starter", "growth", "agency"]) });

export const clientForm = z.object({ name: text("Enter the client's name", 100) });

export const inviteForm = z.object({
  email: text("Enter their email address", 254),
  role: z.enum(["member", "viewer"], { error: "Choose a role" }),
});

export const switchWorkspaceForm = z.object({ workspaceId: text("Choose a workspace", 100) });

export const brandingForm = z.object({
  senderName: text("Enter the name reports come from", 60),
  accentColor: text("Choose a colour", 7),
  logoUrl: z.string().max(2048, "Use at most 2048 characters").default(""),
  replyTo: text("Enter the address clients reply to", 254),
  footer: z.string().max(200, "Use at most 200 characters").default(""),
});

export const sendReportForm = z.object({
  recipients: text("Enter at least one address", 2000),
  weekly: z
    .string()
    .optional()
    .transform((value) => value === "on"),
});

export type FieldErrors = Partial<Record<string, string>>;

/** Edge validation for Server Actions: shape and size only; the domain checks meaning. */
export const parseForm = <T extends z.ZodType>(
  schema: T,
  data: FormData,
): Result<z.infer<T>, FieldErrors> => {
  const raw = Object.fromEntries(
    [...data.entries()].filter(([, value]) => typeof value === "string"),
  );
  const parsed = schema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return err(errors);
};

/** Post text; LinkedIn's 3,000 is the widest limit, and the domain applies each channel's own. */
export const postForm = z.object({ body: text("The post needs text", 3000) });

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const MAX_OFFSET_MINUTES = 14 * 60;

/**
 * A `datetime-local` value is the founder's wall-clock time; the browser adds its
 * `getTimezoneOffset()` (minutes behind UTC) so the server can store the moment in UTC.
 */
export const scheduleForm = z
  .object({
    publishAt: z
      .string()
      .default("")
      .refine(
        (value) => LOCAL_DATE_TIME.test(value) && !Number.isNaN(Date.parse(`${value}:00Z`)),
        "Choose a date and time",
      ),
    tzOffset: z
      .string()
      .default("0")
      .refine((value) => /^-?\d{1,4}$/.test(value), "Unknown timezone")
      .transform(Number)
      .refine((value) => Math.abs(value) <= MAX_OFFSET_MINUTES, "Unknown timezone"),
  })
  .transform(({ publishAt, tzOffset }) => ({
    publishAt: new Date(Date.parse(`${publishAt}:00Z`) + tzOffset * 60_000),
  }));

/** The launch kit editor. Lengths match the domain's listing limits; counts are checked there. */
export const launchKitForm = z.object({
  name: text("Enter the product name", 60),
  tagline: text("Enter a tagline", 60),
  shortDescription: text("Enter a short description", 160),
  longDescription: text("Enter a long description", 1000),
  features: lines(6, 120).refine((items) => items.length >= 3, "List 3 to 6 key features"),
  categories: lines(3, 40).refine((items) => items.length >= 1, "List 1 to 3 categories"),
  makerComment: text("Enter the maker's first comment", 1000),
});

export const liveForm = z.object({ listingUrl: text("Paste the address of your listing", 2048) });

export const rejectForm = z.object({ reason: text("Say why it was rejected", 500) });

/** Rejecting an article: the reason is optional. */
export const articleRejectForm = z.object({
  reason: z.string().trim().max(500, "Use at most 500 characters").default(""),
});

export interface DirectoryFilter {
  readonly kind?: "launch_platform" | "directory" | "community";
  readonly pricing?: "free" | "freemium" | "paid";
  readonly topic?: string;
}

const kinds = ["launch_platform", "directory", "community"] as const;
const pricings = ["free", "freemium", "paid"] as const;

/** Directory filters from the query string. Free directories by default; "all" lifts that. */
export const parseDirectoryFilter = (
  query: Readonly<Record<string, string | undefined>>,
): DirectoryFilter => {
  const kind = kinds.find((k) => k === query.kind);
  const pricing =
    query.pricing === "all" ? undefined : (pricings.find((p) => p === query.pricing) ?? "free");
  const topic =
    query.topic !== undefined && /^[a-z0-9-]{1,40}$/.test(query.topic) ? query.topic : undefined;
  return {
    ...(kind ? { kind } : {}),
    ...(pricing ? { pricing } : {}),
    ...(topic ? { topic } : {}),
  };
};

export const plausibleForm = z.object({
  siteId: text("Enter the domain Plausible shows for your site", 253),
  apiKey: text("Paste a Stats API key", 500),
  baseUrl: optional(2048),
});

export const analyticsPropertiesForm = z.object({
  searchConsoleSite: optional(2048),
  ga4PropertyId: optional(40),
});

const INVITE_TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

/** An invitation token carried through sign-up or log-in, or null when it is not one. */
export const parseInviteToken = (value: unknown): string | null =>
  typeof value === "string" && INVITE_TOKEN.test(value) ? value : null;
