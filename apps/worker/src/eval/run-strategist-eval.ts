// `pnpm eval` (strategist suite): plans recorded weeks with real Claude and fails when any plan
// uses a keyword or angle it was not offered, breaks the limits, or states an unknown figure.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createStrategistEvalAgent } from "../container";
import { parseEvalConfig } from "./brief-eval";
import {
  parseStrategistEvalCase,
  planRequestOf,
  scorePlan,
  summarisePlans,
  type PlanScore,
} from "./strategist-eval";

const PRICES: Partial<Record<string, { inputPerMillion: number; outputPerMillion: number }>> = {
  "claude-opus-5-5": { inputPerMillion: 4, outputPerMillion: 20 },
};

const casesDir = process.argv[2] ?? join(import.meta.dirname, "../../../../evals/strategy/cases");
const mark = (value: boolean) => (value ? "✓" : "✗");
const percent = (rate: number) => `${Math.round(rate * 100)}%`;

function fail(message: string): never {
  console.error(`pnpm eval (strategist): ${message}`);
  process.exit(1);
}

const config = parseEvalConfig(process.env);
if (!config.ok) fail(config.error);
const { strategist, meter } = createStrategistEvalAgent(config.value);

const files = (await readdir(casesDir)).filter((file) => file.endsWith(".json")).sort();
const scores: PlanScore[] = [];
for (const file of files) {
  const evalCase = parseStrategistEvalCase(
    JSON.parse(await readFile(join(casesDir, file), "utf8")),
  );
  if (!evalCase.ok) fail(`${file}: ${evalCase.error}`);
  const request = planRequestOf(evalCase.value);
  const score = scorePlan(evalCase.value, request, await strategist.plan(request));
  scores.push(score);
  console.log(
    `${mark(score.passed)} ${score.name.padEnd(20)} grounded ${mark(score.grounded)}  within limits ${mark(score.withinLimits)}  known figures ${mark(score.figuresGrounded)}  goal ${mark(score.hasGoal)}  no hype ${mark(score.noHype)}  articles + posts ${mark(score.mixesArticlesAndPosts)}${score.unknownFigures.length > 0 ? `  unknown: ${score.unknownFigures.join(", ")}` : ""}${score.error ? `  error: ${score.error}` : ""}`,
  );
}

const summary = summarisePlans(scores);
const prices = PRICES[config.value.model];
console.log(
  `\nStrategist eval on ${config.value.model}: ${summary.plans} weeks, pass ${percent(summary.passRate)} (threshold 100%)`,
);
console.log(
  `Usage: ${meter.usage.calls} calls, ${meter.usage.inputTokens} input + ${meter.usage.outputTokens} output tokens${prices ? `, about $${meter.costUsd(prices).toFixed(2)}` : ""}`,
);
if (!summary.meetsThresholds) fail("scores are below the thresholds");
