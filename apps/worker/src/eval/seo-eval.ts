import { err, ok, type Result } from "@nuvantre/domain";
import type { Draft, DraftError } from "@nuvantre/ports";
import { z } from "zod";

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
});

export type SeoEvalCase = z.infer<typeof seoEvalCaseSchema>;

export const parseSeoEvalCase = (json: unknown): Result<SeoEvalCase, string> => {
  const parsed = seoEvalCaseSchema.safeParse(json);
  return parsed.success
    ? ok(parsed.data)
    : err(parsed.error.issues[0]?.message ?? "Invalid SEO eval case");
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
  readonly words: number;
  readonly passed: boolean;
  readonly error: string | undefined;
}

export const scoreArticle = (
  evalCase: SeoEvalCase,
  result: Result<Draft, DraftError>,
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
      words: 0,
      passed: false,
      error: `${result.error.code}: ${result.error.message}`,
    };
  }
  const { title, body, citedFacts } = result.value;
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
  return {
    name: evalCase.name,
    drafted: true,
    citesOnlyBriefFacts,
    noForbiddenClaims,
    targetsKeyword,
    longEnough,
    structured,
    words,
    passed: citesOnlyBriefFacts && noForbiddenClaims && targetsKeyword && longEnough && structured,
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
    meetsThresholds: scores.length > 0 && factRate === 1 && passRate === 1,
  };
};
