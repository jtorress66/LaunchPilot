// `pnpm eval` (launch-kit suite): writes a launch kit for recorded briefs with real Claude and
// fails when any kit breaks a field limit, the brief-facts rule, the hype rule or Show HN's format.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createLaunchEvalWriter } from "../container";
import { parseEvalConfig } from "./brief-eval";
import { parseLaunchEvalCase, scoreKit, summariseKits, type KitScore } from "./launch-eval";
import { EVAL_RESULTS_FILE, recordEvalResult } from "./results";
import { evalThresholds } from "./thresholds";

const PRICES: Partial<Record<string, { inputPerMillion: number; outputPerMillion: number }>> = {
  "claude-opus-5-5": { inputPerMillion: 4, outputPerMillion: 20 },
};

const casesDir = process.argv[2] ?? join(import.meta.dirname, "../../../../evals/launch/cases");
const mark = (value: boolean) => (value ? "✓" : "✗");
const percent = (rate: number) => `${Math.round(rate * 100)}%`;

function fail(message: string): never {
  console.error(`pnpm eval (launch-kit): ${message}`);
  process.exit(1);
}

const config = parseEvalConfig(process.env);
if (!config.ok) fail(config.error);
const { writer, meter } = createLaunchEvalWriter(config.value);

const files = (await readdir(casesDir)).filter((file) => file.endsWith(".json")).sort();
const scores: KitScore[] = [];
for (const file of files) {
  const evalCase = parseLaunchEvalCase(JSON.parse(await readFile(join(casesDir, file), "utf8")));
  if (!evalCase.ok) fail(`${file}: ${evalCase.error}`);
  const c = evalCase.value;
  const score = scoreKit(c, await writer.draft({ brief: c.brief, product: c.product }));
  scores.push(score);
  console.log(
    `${mark(score.passed)} ${score.name.padEnd(20)} limits ${mark(score.withinLimits)}  brief facts only ${mark(score.citesOnlyBriefFacts)}  no invented claims ${mark(score.noForbiddenClaims)}  no hype ${mark(score.noHype)}  Show HN title ${mark(score.showHnTitle)}  all communities ${mark(score.allCommunities)}${score.forbiddenFound.length > 0 ? `  found: ${score.forbiddenFound.join(", ")}` : ""}${score.error ? `  error: ${score.error}` : ""}`,
  );
}

const summary = summariseKits(scores);
const prices = PRICES[config.value.model];
console.log(
  `\nLaunch kit eval on ${config.value.model}: ${summary.kits} kits, pass ${percent(summary.passRate)} (threshold ${percent(evalThresholds.launch.pass)})`,
);
console.log(
  `Usage: ${meter.usage.calls} calls, ${meter.usage.inputTokens} input + ${meter.usage.outputTokens} output tokens${prices ? `, about $${meter.costUsd(prices).toFixed(2)}` : ""}`,
);
await recordEvalResult(EVAL_RESULTS_FILE, "launch", {
  model: config.value.model,
  cases: summary.kits,
  rates: { pass: summary.passRate },
  passed: summary.meetsThresholds,
});
if (!summary.meetsThresholds) fail("scores are below the thresholds");
