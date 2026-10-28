import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { recordEvalResult } from "./results";

describe("recordEvalResult", () => {
  it("keeps each suite's latest scores side by side in one file", async () => {
    const file = join(await mkdtemp(join(tmpdir(), "evals-")), "results.json");
    await recordEvalResult(file, "seo", {
      model: "m",
      cases: 3,
      rates: { pass: 1 },
      passed: true,
    });
    await recordEvalResult(file, "social", {
      model: "m",
      cases: 2,
      rates: { pass: 0.5 },
      passed: false,
    });
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({
      seo: { model: "m", cases: 3, rates: { pass: 1 }, passed: true },
      social: { model: "m", cases: 2, rates: { pass: 0.5 }, passed: false },
    });
  });
});
