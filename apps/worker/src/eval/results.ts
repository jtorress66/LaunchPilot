import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface EvalResult {
  readonly model: string;
  readonly cases: number;
  readonly rates: Readonly<Record<string, number>>;
  readonly passed: boolean;
}

/** Where `pnpm eval` leaves every suite's scores, uploaded by CI as an artifact. */
export const EVAL_RESULTS_FILE = join(import.meta.dirname, "../../../../evals/results.json");

const readResults = async (file: string): Promise<Record<string, EvalResult>> => {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Record<string, EvalResult>;
  } catch {
    return {};
  }
};

/** Writes one suite's scores into the results file, keeping the other suites' latest. */
export const recordEvalResult = async (
  file: string,
  suite: string,
  result: EvalResult,
): Promise<void> => {
  const results = { ...(await readResults(file)), [suite]: result };
  await writeFile(file, `${JSON.stringify(results, null, 2)}\n`);
};
