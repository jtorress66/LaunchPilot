// `pnpm eval` (social-post suite): writes X and LinkedIn posts for recorded briefs with real
// Claude and fails when any post breaks the channel limit, the brief-facts rule or the format.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createSocialEvalWriter } from "../container";
import { parseEvalConfig } from "./brief-eval";
import { localeOf } from "./seo-eval";
import { parseSocialEvalCase, scorePost, summarisePosts, type PostScore } from "./social-eval";
import { EVAL_RESULTS_FILE, recordEvalResult } from "./results";
import { evalThresholds } from "./thresholds";

const PRICES: Partial<Record<string, { inputPerMillion: number; outputPerMillion: number }>> = {
  "claude-opus-5-5": { inputPerMillion: 4, outputPerMillion: 20 },
};

const casesDir = process.argv[2] ?? join(import.meta.dirname, "../../../../evals/social/cases");
const mark = (value: boolean) => (value ? "✓" : "✗");
const percent = (rate: number) => `${Math.round(rate * 100)}%`;

function fail(message: string): never {
  console.error(`pnpm eval (social-post): ${message}`);
  process.exit(1);
}

const config = parseEvalConfig(process.env);
if (!config.ok) fail(config.error);
const { writer, meter } = createSocialEvalWriter(config.value);

const files = (await readdir(casesDir)).filter((file) => file.endsWith(".json")).sort();
const scores: PostScore[] = [];
for (const file of files) {
  const evalCase = parseSocialEvalCase(JSON.parse(await readFile(join(casesDir, file), "utf8")));
  if (!evalCase.ok) fail(`${file}: ${evalCase.error}`);
  const c = evalCase.value;
  for (const angle of c.angles) {
    const score = scorePost(
      c,
      angle,
      await writer.draft({
        brief: c.brief,
        channel: angle.channel,
        task: { kind: "social_post", title: angle.angle },
        ...(angle.link === undefined ? {} : { link: angle.link }),
        locale: localeOf(c),
      }),
    );
    scores.push(score);
    console.log(
      `${mark(score.passed)} ${score.name.padEnd(24)} ${String(score.characters).padStart(4)} chars ${mark(score.withinLimit)}  brief facts only ${mark(score.citesOnlyBriefFacts)}  no invented claims ${mark(score.noForbiddenClaims)}  hashtags ${mark(score.fewHashtags)}  link ${mark(score.includesLink)}  language ${mark(score.writesInLanguage)}${score.error ? `  error: ${score.error}` : ""}`,
    );
  }
}

const summary = summarisePosts(scores);
const prices = PRICES[config.value.model];
console.log(
  `\nSocial post eval on ${config.value.model}: ${summary.posts} posts, pass ${percent(summary.passRate)} (threshold ${percent(evalThresholds.social.pass)})`,
);
console.log(
  `Usage: ${meter.usage.calls} calls, ${meter.usage.inputTokens} input + ${meter.usage.outputTokens} output tokens${prices ? `, about $${meter.costUsd(prices).toFixed(2)}` : ""}`,
);
await recordEvalResult(EVAL_RESULTS_FILE, "social", {
  model: config.value.model,
  cases: summary.posts,
  rates: { pass: summary.passRate },
  passed: summary.meetsThresholds,
});
if (!summary.meetsThresholds) fail("scores are below the thresholds");
