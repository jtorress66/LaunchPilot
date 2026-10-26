// `pnpm eval`: LLM evals against the real model. Needs ANTHROPIC_API_KEY.
// Run it whenever a prompt changes; it exits non-zero when scores fall below the thresholds.
import { spawnSync } from "node:child_process";

const suites = [
  ["--filter", "@nuvantre/worker", "eval"],
  ["--filter", "@nuvantre/worker", "eval:seo"],
  ["--filter", "@nuvantre/worker", "eval:social"],
  ["--filter", "@nuvantre/worker", "eval:launch"],
  ["--filter", "@nuvantre/worker", "eval:analyst"],
  ["--filter", "@nuvantre/worker", "eval:strategist"],
  ["--filter", "@nuvantre/worker", "eval:reviewer"],
];
for (const suite of suites) {
  const { status } = spawnSync("pnpm", ["--silent", ...suite], { stdio: "inherit" });
  if (status !== 0) process.exit(status ?? 1);
}
