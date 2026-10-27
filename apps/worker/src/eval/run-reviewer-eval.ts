// `pnpm eval` (reviewer suite): reviews hand-labelled drafts with real Claude and fails when any
// verdict disagrees with its label: a bad draft recommended, or a good one held back.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createReviewerEvalAgent } from "../container";
import { parseEvalConfig } from "./brief-eval";
import {
  parseReviewerEvalCase,
  reviewRequestOf,
  scoreReview,
  summariseReviews,
  type ReviewScore,
} from "./reviewer-eval";
import { EVAL_RESULTS_FILE, recordEvalResult } from "./results";
import { evalThresholds } from "./thresholds";

const PRICES: Partial<Record<string, { inputPerMillion: number; outputPerMillion: number }>> = {
  "claude-opus-5-5": { inputPerMillion: 4, outputPerMillion: 20 },
};

const casesDir = process.argv[2] ?? join(import.meta.dirname, "../../../../evals/review/cases");
const mark = (value: boolean) => (value ? "✓" : "✗");
const percent = (rate: number) => `${Math.round(rate * 100)}%`;

function fail(message: string): never {
  console.error(`pnpm eval (reviewer): ${message}`);
  process.exit(1);
}

const config = parseEvalConfig(process.env);
if (!config.ok) fail(config.error);
const { reviewer, meter } = createReviewerEvalAgent(config.value);

const files = (await readdir(casesDir)).filter((file) => file.endsWith(".json")).sort();
const scores: ReviewScore[] = [];
for (const file of files) {
  const evalCase = parseReviewerEvalCase(JSON.parse(await readFile(join(casesDir, file), "utf8")));
  if (!evalCase.ok) fail(`${file}: ${evalCase.error}`);
  for (const draft of evalCase.value.drafts) {
    const result = await reviewer.review(reviewRequestOf(evalCase.value, draft));
    const score = scoreReview(evalCase.value, draft, result);
    scores.push(score);
    console.log(
      `${mark(score.passed)} ${score.name.padEnd(36)} expected ${draft.expected.padEnd(13)} got ${(score.decision ?? "-").padEnd(13)} blockers named ${mark(score.explainsBlockers)}${score.error ? `  error: ${score.error}` : ""}`,
    );
    // On a wrong verdict, show what the reviewer said so the prompt can be fixed.
    if (!score.matchesLabel && result.ok) {
      for (const issue of result.value.issues)
        console.log(`    ${issue.severity}: ${issue.message}`);
    }
  }
}

const summary = summariseReviews(scores);
const prices = PRICES[config.value.model];
console.log(
  `\nReviewer eval on ${config.value.model}: ${summary.drafts} drafts, pass ${percent(summary.passRate)} (threshold ${percent(evalThresholds.reviewer.pass)})`,
);
console.log(
  `Usage: ${meter.usage.calls} calls, ${meter.usage.inputTokens} input + ${meter.usage.outputTokens} output tokens${prices ? `, about $${meter.costUsd(prices).toFixed(2)}` : ""}`,
);
await recordEvalResult(EVAL_RESULTS_FILE, "reviewer", {
  model: config.value.model,
  cases: summary.drafts,
  rates: { pass: summary.passRate },
  passed: summary.meetsThresholds,
});
if (!summary.meetsThresholds) fail("scores are below the thresholds");
