// `pnpm eval`: drafts a brief with real Claude for every recorded site in evals/brief/sites
// and fails when grounding or completeness drop below the thresholds.
import { parseHttpUrl } from "@nuvantre/domain";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createBriefEvalAgent } from "../container";
import {
  parseEvalCase,
  parseEvalConfig,
  scoreBrief,
  summarise,
  type CaseScore,
} from "./brief-eval";

/** Published per-million-token prices, for the cost line of the report. */
const PRICES: Partial<Record<string, { inputPerMillion: number; outputPerMillion: number }>> = {
  "claude-opus-5-5": { inputPerMillion: 4, outputPerMillion: 20 },
};

const sitesDir = process.argv[2] ?? join(import.meta.dirname, "../../../../evals/brief/sites");
const mark = (value: boolean) => (value ? "✓" : "✗");
const percent = (rate: number) => `${Math.round(rate * 100)}%`;

function fail(message: string): never {
  console.error(`pnpm eval: ${message}`);
  process.exit(1);
}

const config = parseEvalConfig(process.env);
if (!config.ok) fail(config.error);
const { model } = config.value;
const { agent, meter } = createBriefEvalAgent(config.value);

const files = (await readdir(sitesDir)).filter((file) => file.endsWith(".json")).sort();
const scores: CaseScore[] = [];
for (const file of files) {
  const evalCase = parseEvalCase(JSON.parse(await readFile(join(sitesDir, file), "utf8")));
  if (!evalCase.ok) fail(`${file}: ${evalCase.error}`);
  const c = evalCase.value;
  const url = parseHttpUrl(c.site.url);
  if (!url.ok) fail(`${file}: ${url.error.message}`);
  const site = { url: url.value, pages: c.site.pages };
  const score = scoreBrief(c, await agent.draft({ productName: c.productName, site }));
  scores.push(score);
  console.log(
    `${mark(score.passed)} ${score.name.padEnd(18)} grounded ${mark(score.grounded)}  complete ${mark(score.complete)}  facts ${String(score.facts).padStart(2)} (dropped ${score.dropped})  no invented claims ${mark(score.noForbiddenClaims)}${score.error ? `  error: ${score.error}` : ""}`,
  );
}

const summary = summarise(scores);
const prices = PRICES[model];
console.log(
  `\nBrief eval on ${model}: ${summary.cases} sites, grounding ${percent(summary.groundingRate)} (threshold 100%), pass ${percent(summary.passRate)} (threshold 100%)`,
);
console.log(
  `Usage: ${meter.usage.calls} calls, ${meter.usage.inputTokens} input + ${meter.usage.outputTokens} output tokens${prices ? `, about $${meter.costUsd(prices).toFixed(2)}` : ""}`,
);
if (!summary.meetsThresholds) fail("scores are below the thresholds");
