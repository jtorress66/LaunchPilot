import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const rate = z.number().min(0).max(1);

const thresholdsSchema = z.object({
  brief: z.object({ grounding: rate, pass: rate }),
  seo: z.object({ facts: rate, pass: rate }),
  social: z.object({ pass: rate }),
  launch: z.object({ pass: rate }),
  analyst: z.object({ pass: rate }),
  strategist: z.object({ pass: rate }),
  reviewer: z.object({ pass: rate }),
});

export type EvalThresholds = z.infer<typeof thresholdsSchema>;

export const parseThresholds = (json: unknown): EvalThresholds => {
  const parsed = thresholdsSchema.safeParse(json);
  if (!parsed.success) {
    const where = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`evals/thresholds.json is invalid at ${where}`);
  }
  return parsed.data;
};

/** Every suite's minimum scores, kept in one file so they cannot be loosened quietly. */
export const evalThresholds: EvalThresholds = parseThresholds(
  JSON.parse(readFileSync(join(import.meta.dirname, "../../../../evals/thresholds.json"), "utf8")),
);

/** Whether a run met its minimums: there were cases, and each rate reached its threshold. */
export const meets = (
  cases: number,
  rates: Readonly<Record<string, number>>,
  minimums: Readonly<Record<string, number>>,
): boolean =>
  cases > 0 && Object.entries(minimums).every(([name, minimum]) => (rates[name] ?? 0) >= minimum);
