import { validateWeekPlan } from "@launchpilot/domain";
import type { PlanRequest } from "@launchpilot/ports";
import { aPlanRequest, aWeeklyReport, FakeLlmClient } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { planProblems } from "./plan-rules";
import { StrategistAgent } from "./strategist-agent";
import { TemplateStrategist } from "./template-strategist";

const request: PlanRequest = aPlanRequest({ lastWeek: aWeeklyReport() });
const [kw1, kw2] = request.candidates.keywords;
const [xAngle] = request.candidates.angles;
if (!kw1 || !kw2 || !xAngle) throw new Error("fixture candidates missing");

const article = (keyword: string, rationale = "A realistic keyword for a small site") => ({
  kind: "seo_article" as const,
  channel: "blog" as const,
  title: `Article: ${keyword}`,
  rationale,
  keyword,
});
const goodPlan = {
  name: "Week of 5 January",
  goal: "Turn last week's 120 search clicks into more trial sign-ups",
  tasks: [
    article(
      kw1.keyword,
      `${String(kw1.monthlySearches)} searches a month at difficulty ${String(kw1.difficulty)}`,
    ),
    {
      kind: "social_post" as const,
      channel: "x" as const,
      title: xAngle.angle,
      rationale: "Keeps followers close",
      angle: xAngle.angle,
    },
  ],
};

describe("planProblems", () => {
  it("finds nothing wrong with a grounded plan that cites the report and the candidates", () => {
    expect(planProblems(request, goodPlan)).toEqual([]);
  });

  it.each([
    ["no tasks", { ...goodPlan, tasks: [] }, "Plan at least one task."],
    [
      "a keyword nobody offered",
      { ...goodPlan, tasks: [article("best analytics 2027")] },
      '"Article: best analytics 2027" uses a keyword that was not offered.',
    ],
    [
      "more tasks than the allowance",
      { ...goodPlan, tasks: [article(kw1.keyword), article(kw2.keyword)] },
      "Plan at most 1 tasks: the plan's allowance.",
    ],
    [
      "a figure from nowhere",
      { ...goodPlan, goal: "Reach 5,000 visitors" },
      "These figures are in neither the report nor the candidates: 5,000.",
    ],
    ["hype", { ...goodPlan, goal: "A revolutionary week" }, 'Remove hype: "revolutionary".'],
  ])("reports %s", (_case, plan, problem) => {
    const limited = problem.startsWith("Plan at most") ? { ...request, allowance: 1 } : request;
    expect(planProblems(limited, plan)).toContain(problem);
  });
});

describe("TemplateStrategist", () => {
  it("plans two articles and the offered posts within the caps, grounded and number-safe", async () => {
    const result = await new TemplateStrategist().plan(request);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.tasks.map((t) => t.channel)).toEqual([
      "blog",
      "blog",
      "x",
      "x",
      "x",
      "linkedin",
      "linkedin",
    ]);
    expect(validateWeekPlan(result.value.tasks, request).dropped).toEqual([]);
    expect(planProblems(request, result.value)).toEqual([]);
    expect(result.value.goal).toBe("Build on last week's 120 search clicks");
  });

  it("refuses to plan when nothing was offered", async () => {
    expect(
      await new TemplateStrategist().plan({ ...request, candidates: { keywords: [], angles: [] } }),
    ).toMatchObject({ ok: false, error: { code: "planning_failed" } });
  });

  it("stays within a small allowance, articles first, and plans without a report", async () => {
    const result = await new TemplateStrategist().plan({
      ...request,
      allowance: 3,
      lastWeek: null,
    });
    expect(result.ok && result.value.tasks.map((t) => t.channel)).toEqual(["blog", "blog", "x"]);
    expect(result.ok && result.value.goal).toBe("Grow organic reach for Acme Analytics");
  });
});

const reply = (plan: unknown) => JSON.stringify(plan);
const asAnswer = (plan: typeof goodPlan) => ({
  ...plan,
  tasks: plan.tasks.map((t) => ({ keyword: null, angle: null, ...t })),
});

describe("StrategistAgent", () => {
  it("shows the model the candidates, the allowance, the caps and last week's figures", async () => {
    const llm = new FakeLlmClient().reply(reply(asAnswer(goodPlan)));
    await new StrategistAgent(llm).plan(request);
    const prompt = llm.requests[0]?.messages[0]?.content ?? "";
    expect(prompt).toContain(
      `- "${kw1.keyword}": ${String(kw1.monthlySearches)} searches a month, difficulty ${String(kw1.difficulty)}`,
    );
    expect(prompt).toContain(`- x: "${xAngle.angle}"`);
    expect(prompt).toContain("Allowance: at most 10 tasks");
    expect(prompt).toContain("blog 2, x 3, linkedin 2");
    expect(prompt).toContain("Search clicks: 120 (last week 100, +20%)");
    expect(llm.requests[0]?.system).not.toContain("Acme");
  });

  it("says when there is no report yet", async () => {
    const llm = new FakeLlmClient().reply(reply(asAnswer(goodPlan)));
    await new StrategistAgent(llm).plan({ ...request, lastWeek: null });
    expect(llm.requests[0]?.messages[0]?.content).toContain("Last week: no report yet");
  });

  it("returns the plan, with empty keyword and angle fields dropped", async () => {
    const llm = new FakeLlmClient().reply(reply(asAnswer(goodPlan)));
    expect(await new StrategistAgent(llm).plan(request)).toEqual({ ok: true, value: goodPlan });
  });

  it("asks once for a rewrite naming the problems, then fails", async () => {
    const bad = asAnswer({ ...goodPlan, goal: "Reach 5,000 visitors" });
    const llm = new FakeLlmClient().reply(reply(bad)).reply(reply(asAnswer(goodPlan)));
    expect((await new StrategistAgent(llm).plan(request)).ok).toBe(true);
    expect(llm.requests[1]?.messages.at(-1)?.content).toContain("5,000");

    const stubborn = new FakeLlmClient().reply(reply(bad)).reply(reply(bad));
    expect(await new StrategistAgent(stubborn).plan(request)).toMatchObject({
      ok: false,
      error: { code: "planning_failed" },
    });
  });

  it.each([
    ["text that is not JSON", "Plan: write more."],
    ["JSON in the wrong shape", JSON.stringify({ name: 1 })],
  ])("fails on %s", async (_case, text) => {
    const llm = new FakeLlmClient().reply(text);
    expect(await new StrategistAgent(llm).plan(request)).toMatchObject({
      ok: false,
      error: { code: "planning_failed" },
    });
  });

  it("fails when the plan is cut off, and maps an outage to unavailable", async () => {
    const cut = new FakeLlmClient().replyTruncated(reply(asAnswer(goodPlan)));
    expect(await new StrategistAgent(cut).plan(request)).toMatchObject({
      ok: false,
      error: { code: "planning_failed" },
    });
    const down = new FakeLlmClient().fail({
      code: "unavailable",
      message: "Down",
      retryable: true,
    });
    expect(await new StrategistAgent(down).plan(request)).toMatchObject({
      ok: false,
      error: { code: "unavailable", retryable: true },
    });
  });
});
