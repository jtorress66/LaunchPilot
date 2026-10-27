// `pnpm eval` (seo-article suite): writes one article per recorded brief with real Claude and
// fails when fact use, structure or length fall below the thresholds.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createSeoEvalWriter } from "../container";
import { parseEvalConfig } from "./brief-eval";
import {
  localeOf,
  parseSeoEvalCase,
  rawBody,
  scoreArticle,
  summariseArticles,
  type ArticleScore,
} from "./seo-eval";
import { EVAL_RESULTS_FILE, recordEvalResult } from "./results";
import { evalThresholds } from "./thresholds";

const PRICES: Partial<Record<string, { inputPerMillion: number; outputPerMillion: number }>> = {
  "claude-opus-5-5": { inputPerMillion: 4, outputPerMillion: 20 },
};

const casesDir = process.argv[2] ?? join(import.meta.dirname, "../../../../evals/seo/cases");
const mark = (value: boolean) => (value ? "✓" : "✗");
const percent = (rate: number) => `${Math.round(rate * 100)}%`;

function fail(message: string): never {
  console.error(`pnpm eval (seo-article): ${message}`);
  process.exit(1);
}

const config = parseEvalConfig(process.env);
if (!config.ok) fail(config.error);
const { writer, meter } = createSeoEvalWriter(config.value);

const files = (await readdir(casesDir)).filter((file) => file.endsWith(".json")).sort();
const scores: ArticleScore[] = [];
for (const file of files) {
  const evalCase = parseSeoEvalCase(JSON.parse(await readFile(join(casesDir, file), "utf8")));
  if (!evalCase.ok) fail(`${file}: ${evalCase.error}`);
  const c = evalCase.value;
  const result = await writer.draft({
    brief: c.brief,
    channel: "blog",
    task: { kind: "seo_article", title: `Article: ${c.keyword}` },
    keywords: [c.keyword],
    locale: localeOf(c),
    internalLinks: c.internalLinks ?? [],
  });
  const score = scoreArticle(c, result, rawBody(meter.lastText));
  scores.push(score);
  console.log(
    `${mark(score.passed)} ${score.name.padEnd(18)} brief facts only ${mark(score.citesOnlyBriefFacts)}  no invented claims ${mark(score.noForbiddenClaims)}  keyword ${mark(score.targetsKeyword)}  ${String(score.words).padStart(4)} words ${mark(score.longEnough)}  sections ${mark(score.structured)}  slug+excerpt ${mark(score.hasSlugAndExcerpt)}  links ok ${mark(score.linksOnlyToPublished)}  links used ${mark(score.linksWhenUseful)}  language ${mark(score.writesInLanguage)}${score.error ? `  error: ${score.error}` : ""}`,
  );
}

const summary = summariseArticles(scores);
const prices = PRICES[config.value.model];
console.log(
  `\nSEO article eval on ${config.value.model}: ${summary.cases} briefs, brief facts only ${percent(summary.factRate)} (threshold ${percent(evalThresholds.seo.facts)}), pass ${percent(summary.passRate)} (threshold ${percent(evalThresholds.seo.pass)})`,
);
console.log(
  `Usage: ${meter.usage.calls} calls, ${meter.usage.inputTokens} input + ${meter.usage.outputTokens} output tokens${prices ? `, about $${meter.costUsd(prices).toFixed(2)}` : ""}`,
);
await recordEvalResult(EVAL_RESULTS_FILE, "seo", {
  model: config.value.model,
  cases: summary.cases,
  rates: { facts: summary.factRate, pass: summary.passRate },
  passed: summary.meetsThresholds,
});
if (!summary.meetsThresholds) fail("scores are below the thresholds");
