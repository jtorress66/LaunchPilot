import {
  err,
  linksOutside,
  ok,
  parseContentLocale,
  parseSlug,
  slugify,
  type ContentLocale,
  type Result,
} from "@nuvantre/domain";
import type { Draft, DraftError } from "@nuvantre/ports";
import { z } from "zod";
import { writesIn } from "./language-check";
import { evalThresholds, meets } from "./thresholds";

/** One recorded brief and keyword the SEO writer is evaluated on. */
const seoEvalCaseSchema = z.object({
  name: z.string().min(1),
  keyword: z.string().min(1),
  /** Claims the brief never makes; none may appear in the article. */
  forbidden: z.array(z.string().min(1)),
  brief: z.object({
    audience: z.string(),
    problem: z.string(),
    solution: z.string(),
    differentiators: z.array(z.string()),
    tone: z.string(),
    facts: z.array(z.string()),
  }),
  /** "de-DE"; US English when absent. */
  locale: z.string().optional(),
  /** Published articles the writer may link to. */
  internalLinks: z.array(z.object({ title: z.string(), url: z.url() })).optional(),
});

export type SeoEvalCase = z.infer<typeof seoEvalCaseSchema>;

export const parseSeoEvalCase = (json: unknown): Result<SeoEvalCase, string> => {
  const parsed = seoEvalCaseSchema.safeParse(json);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid SEO eval case");
  if (parsed.data.locale !== undefined && !parseContentLocale(parsed.data.locale).ok) {
    return err(`Unknown locale "${parsed.data.locale}"`);
  }
  return ok(parsed.data);
};

/** The case's language and market, US English by default. */
export const localeOf = ({ locale }: { locale?: string | undefined }): ContentLocale => {
  const parsed = parseContentLocale(locale ?? "en-US");
  return parsed.ok ? parsed.value : { language: "en", market: "US" };
};

/** The body from the model's raw JSON answer, to judge links before the writer cleans them. */
export const rawBody = (text: string | undefined): string | undefined => {
  if (text === undefined) return undefined;
  try {
    const answer = JSON.parse(text) as { body?: unknown };
    return typeof answer.body === "string" ? answer.body : undefined;
  } catch {
    return undefined;
  }
};

const MAX_EXCERPT = 160;

const goodSeo = (keyword: string, seo: { slug: string; excerpt: string } | undefined) => {
  if (seo === undefined || !parseSlug(seo.slug).ok) return false;
  const keywordWords = slugify(keyword).split("-");
  const slugWords = new Set(seo.slug.split("-"));
  return (
    keywordWords.some((w) => slugWords.has(w)) &&
    seo.excerpt.trim() !== "" &&
    seo.excerpt.length <= MAX_EXCERPT
  );
};

const MIN_WORDS = 900;
const MIN_SECTIONS = 3;

export interface ArticleScore {
  readonly name: string;
  readonly drafted: boolean;
  /** Safety rule: every cited fact is an approved brief fact. */
  readonly citesOnlyBriefFacts: boolean;
  readonly noForbiddenClaims: boolean;
  /** The keyword is in the title or the first section heading. */
  readonly targetsKeyword: boolean;
  readonly longEnough: boolean;
  readonly structured: boolean;
  /** A valid slug with a keyword word, and an excerpt of at most 160 characters. */
  readonly hasSlugAndExcerpt: boolean;
  /** Safety rule: the model's own answer links only to the published articles offered. */
  readonly linksOnlyToPublished: boolean;
  /** When related articles are offered, at least one is linked. */
  readonly linksWhenUseful: boolean;
  readonly writesInLanguage: boolean;
  readonly words: number;
  readonly passed: boolean;
  readonly error: string | undefined;
}

export const scoreArticle = (
  evalCase: SeoEvalCase,
  result: Result<Draft, DraftError>,
  /** The body as the model wrote it, before the writer unlinked anything. */
  rawBody?: string,
): ArticleScore => {
  if (!result.ok) {
    return {
      name: evalCase.name,
      drafted: false,
      citesOnlyBriefFacts: false,
      noForbiddenClaims: false,
      targetsKeyword: false,
      longEnough: false,
      structured: false,
      hasSlugAndExcerpt: false,
      linksOnlyToPublished: false,
      linksWhenUseful: false,
      writesInLanguage: false,
      words: 0,
      passed: false,
      error: `${result.error.code}: ${result.error.message}`,
    };
  }
  const { title, body, citedFacts, seo } = result.value;
  const links = evalCase.internalLinks ?? [];
  const text = `${title}\n${body}`.toLowerCase();
  const headings = body.split("\n").filter((line) => line.startsWith("## "));
  const keyword = evalCase.keyword.toLowerCase();
  const words = body.split(/\s+/).filter((w) => /\w/.test(w)).length;

  const citesOnlyBriefFacts = citedFacts.every((fact) => evalCase.brief.facts.includes(fact));
  const noForbiddenClaims = evalCase.forbidden.every(
    (claim) => !text.includes(claim.toLowerCase()),
  );
  const targetsKeyword =
    title.toLowerCase().includes(keyword) ||
    (headings[0]?.toLowerCase().includes(keyword) ?? false);
  const longEnough = words >= MIN_WORDS;
  const structured = headings.length >= MIN_SECTIONS;
  const checks = {
    citesOnlyBriefFacts,
    noForbiddenClaims,
    targetsKeyword,
    longEnough,
    structured,
    hasSlugAndExcerpt: goodSeo(evalCase.keyword, seo),
    linksOnlyToPublished: linksOutside(rawBody ?? body, links).length === 0,
    linksWhenUseful: links.length === 0 || links.some((l) => body.includes(`(${l.url})`)),
    writesInLanguage: writesIn(`${title}\n${body}`, localeOf(evalCase).language),
  };
  return {
    name: evalCase.name,
    drafted: true,
    ...checks,
    words,
    passed: Object.values(checks).every(Boolean),
    error: undefined,
  };
};

export interface ArticleSummary {
  readonly cases: number;
  readonly factRate: number;
  readonly passRate: number;
  readonly meetsThresholds: boolean;
}

/** Thresholds: every article cites only brief facts (safety rule) and every case passes. */
export const summariseArticles = (scores: readonly ArticleScore[]): ArticleSummary => {
  const rate = (count: number) => (scores.length === 0 ? 0 : count / scores.length);
  const factRate = rate(scores.filter((s) => s.drafted && s.citesOnlyBriefFacts).length);
  const passRate = rate(scores.filter((s) => s.passed).length);
  return {
    cases: scores.length,
    factRate,
    passRate,
    meetsThresholds: meets(scores.length, { facts: factRate, pass: passRate }, evalThresholds.seo),
  };
};
