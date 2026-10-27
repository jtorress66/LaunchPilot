// `pnpm eval` (analyst suite): writes notes on recorded weekly reports with real Claude and
// fails when any note states a number the report lacks, a fact the brief lacks, or hype.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createAnalystEvalAgent } from "../container";
import {
  parseAnalystEvalCase,
  reportOf,
  scoreAnalysis,
  summariseAnalyses,
  type AnalysisScore,
} from "./analyst-eval";
import { parseEvalConfig } from "./brief-eval";
import { EVAL_RESULTS_FILE, recordEvalResult } from "./results";
import { evalThresholds } from "./thresholds";

const PRICES: Partial<Record<string, { inputPerMillion: number; outputPerMillion: number }>> = {
  "claude-opus-5-5": { inputPerMillion: 4, outputPerMillion: 20 },
};

const casesDir = process.argv[2] ?? join(import.meta.dirname, "../../../../evals/analytics/cases");
const mark = (value: boolean) => (value ? "✓" : "✗");
const percent = (rate: number) => `${Math.round(rate * 100)}%`;

function fail(message: string): never {
  console.error(`pnpm eval (analyst): ${message}`);
  process.exit(1);
}

const config = parseEvalConfig(process.env);
if (!config.ok) fail(config.error);
const { analyst, meter } = createAnalystEvalAgent(config.value);

const files = (await readdir(casesDir)).filter((file) => file.endsWith(".json")).sort();
const scores: AnalysisScore[] = [];
for (const file of files) {
  const evalCase = parseAnalystEvalCase(JSON.parse(await readFile(join(casesDir, file), "utf8")));
  if (!evalCase.ok) fail(`${file}: ${evalCase.error}`);
  const c = evalCase.value;
  const report = reportOf(c);
  const score = scoreAnalysis(
    c,
    report,
    await analyst.analyse({ product: c.product, brief: c.brief, report }),
  );
  scores.push(score);
  console.log(
    `${mark(score.passed)} ${score.name.padEnd(20)} report numbers only ${mark(score.numbersFromReport)}  brief facts only ${mark(score.citesOnlyBriefFacts)}  no invented claims ${mark(score.noForbiddenClaims)}  no hype ${mark(score.noHype)}  1-3 suggestions ${mark(score.suggestionCount)}  biggest change ${mark(score.namesBiggestChange)}${score.unknownNumbers.length > 0 ? `  unknown: ${score.unknownNumbers.join(", ")}` : ""}${score.error ? `  error: ${score.error}` : ""}`,
  );
}

const summary = summariseAnalyses(scores);
const prices = PRICES[config.value.model];
console.log(
  `\nAnalyst eval on ${config.value.model}: ${summary.reports} reports, pass ${percent(summary.passRate)} (threshold ${percent(evalThresholds.analyst.pass)})`,
);
console.log(
  `Usage: ${meter.usage.calls} calls, ${meter.usage.inputTokens} input + ${meter.usage.outputTokens} output tokens${prices ? `, about $${meter.costUsd(prices).toFixed(2)}` : ""}`,
);
await recordEvalResult(EVAL_RESULTS_FILE, "analyst", {
  model: config.value.model,
  cases: summary.reports,
  rates: { pass: summary.passRate },
  passed: summary.meetsThresholds,
});
if (!summary.meetsThresholds) fail("scores are below the thresholds");
