import { err, isGrounded, ok, type Result } from "@nuvantre/domain";
import type { BriefDraft, BriefDraftError } from "@nuvantre/ports";
import { z } from "zod";
import { evalThresholds, meets } from "./thresholds";

/** One recorded site the brief agent is evaluated on. */
const evalCaseSchema = z.object({
  name: z.string().min(1),
  productName: z.string().min(1),
  /** The brief must contain at least this many grounded facts. */
  minFacts: z.number().int().min(1),
  /** Claims the site never makes; none may appear anywhere in the brief. */
  forbidden: z.array(z.string().min(1)),
  site: z.object({
    url: z.url(),
    pages: z.array(z.object({ url: z.url(), title: z.string(), text: z.string() })).min(1),
  }),
});

export type EvalCase = z.infer<typeof evalCaseSchema>;

export const parseEvalCase = (json: unknown): Result<EvalCase, string> => {
  const parsed = evalCaseSchema.safeParse(json);
  return parsed.success
    ? ok(parsed.data)
    : err(parsed.error.issues[0]?.message ?? "Invalid eval case");
};

export interface EvalConfig {
  readonly apiKey: string;
  readonly model: string;
}

export const parseEvalConfig = (
  env: Readonly<Record<string, string | undefined>>,
): Result<EvalConfig, string> => {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return err(
      "ANTHROPIC_API_KEY is not set. Locally: export ANTHROPIC_API_KEY=… ; in CI: add it under Settings → Secrets and variables → Actions.",
    );
  }
  return ok({ apiKey, model: env.ANTHROPIC_MODEL ?? "claude-opus-5-5" });
};

export interface CaseScore {
  readonly name: string;
  readonly drafted: boolean;
  /** Every fact's supporting quote appears on the site. */
  readonly grounded: boolean;
  /** Audience, problem, solution and tone are all filled in. */
  readonly complete: boolean;
  readonly enoughFacts: boolean;
  readonly noForbiddenClaims: boolean;
  readonly facts: number;
  readonly dropped: number;
  readonly passed: boolean;
  readonly error: string | undefined;
}

const corpusOf = (evalCase: EvalCase) =>
  evalCase.site.pages.map((page) => `${page.title}\n${page.text}`).join("\n\n");

export const scoreBrief = (
  evalCase: EvalCase,
  result: Result<BriefDraft, BriefDraftError>,
): CaseScore => {
  if (!result.ok) {
    return {
      name: evalCase.name,
      drafted: false,
      grounded: false,
      complete: false,
      enoughFacts: false,
      noForbiddenClaims: false,
      facts: 0,
      dropped: 0,
      passed: false,
      error: `${result.error.code}: ${result.error.message}`,
    };
  }
  const { content, evidence, droppedClaims } = result.value;
  const corpus = corpusOf(evalCase);
  const written = [
    content.audience,
    content.problem,
    content.solution,
    content.tone,
    ...content.differentiators,
    ...content.facts,
  ]
    .join("\n")
    .toLowerCase();

  const grounded = evidence.every(({ quote }) => isGrounded(quote, corpus));
  const complete = [content.audience, content.problem, content.solution, content.tone].every(
    (field) => field.trim() !== "",
  );
  const enoughFacts = content.facts.length >= evalCase.minFacts;
  const noForbiddenClaims = evalCase.forbidden.every(
    (claim) => !written.includes(claim.toLowerCase()),
  );
  return {
    name: evalCase.name,
    drafted: true,
    grounded,
    complete,
    enoughFacts,
    noForbiddenClaims,
    facts: content.facts.length,
    dropped: droppedClaims.length,
    passed: grounded && complete && enoughFacts && noForbiddenClaims,
    error: undefined,
  };
};

export interface EvalSummary {
  readonly cases: number;
  readonly groundingRate: number;
  readonly passRate: number;
  readonly meetsThresholds: boolean;
}

/** Thresholds: every brief grounded (safety rule) and every case passing. */

export const summarise = (scores: readonly CaseScore[]): EvalSummary => {
  const rate = (count: number) => (scores.length === 0 ? 0 : count / scores.length);
  const groundingRate = rate(scores.filter((s) => s.grounded).length);
  const passRate = rate(scores.filter((s) => s.passed).length);
  return {
    cases: scores.length,
    groundingRate,
    passRate,
    meetsThresholds: meets(
      scores.length,
      { grounding: groundingRate, pass: passRate },
      evalThresholds.brief,
    ),
  };
};
