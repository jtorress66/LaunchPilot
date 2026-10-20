// `pnpm eval`: LLM evals against the real model. Needs ANTHROPIC_API_KEY.
// Run it whenever a prompt changes; it exits non-zero when scores fall below the thresholds.
import { spawnSync } from "node:child_process";

const suites = [
  ["--filter", "@launchpilot/worker", "eval"],
  ["--filter", "@launchpilot/worker", "eval:seo"],
  ["--filter", "@launchpilot/worker", "eval:social"],
  ["--filter", "@launchpilot/worker", "eval:launch"],
  ["--filter", "@launchpilot/worker", "eval:analyst"],
];
for (const suite of suites) {
  const { status } = spawnSync("pnpm", ["--silent", ...suite], { stdio: "inherit" });
  if (status !== 0) process.exit(status ?? 1);
}
