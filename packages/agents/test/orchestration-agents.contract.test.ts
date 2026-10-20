import { err } from "@launchpilot/domain";
import type { CampaignPlanner, ContentReviewer, LlmClient } from "@launchpilot/ports";
import { aPlanRequest, FakeLlmClient } from "@launchpilot/testing";
import {
  describeCampaignPlannerContract,
  describeContentReviewerContract,
} from "@launchpilot/testing/contracts";
import { ReviewerAgent, StrategistAgent, TemplateReviewer, TemplateStrategist } from "../src";

/** The template agents only fail on input they cannot work with, so the harness supplies it. */
describeCampaignPlannerContract("TemplateStrategist", () => {
  const strategist = new TemplateStrategist();
  let failing = false;
  const planner: CampaignPlanner = {
    plan: (request) =>
      strategist.plan(failing ? { ...request, candidates: { keywords: [], angles: [] } } : request),
  };
  return {
    planner,
    givenFailure: () => {
      failing = true;
    },
  };
});

/** A model plan built from the contract's own candidates, plus a fact-free rationale. */
const modelPlan = () => {
  const { candidates } = aPlanRequest();
  return JSON.stringify({
    name: "Week of 5 January",
    goal: "Turn search interest into trials",
    tasks: [
      ...candidates.keywords.slice(0, 1).map((k) => ({
        kind: "seo_article",
        channel: "blog",
        title: `Article: ${k.keyword}`,
        rationale: `${String(k.monthlySearches)} searches a month`,
        keyword: k.keyword,
        angle: null,
      })),
      ...candidates.angles.slice(0, 1).map((a) => ({
        kind: "social_post",
        channel: a.channel,
        title: a.angle,
        rationale: "Keeps followers close",
        keyword: null,
        angle: a.angle,
      })),
    ],
  });
};

/** The model answers every call with the plan, or fails every call once told to. */
const scriptedModel = (answer: () => string) => {
  let failing = false;
  const client: LlmClient = {
    complete: (request) =>
      failing
        ? Promise.resolve(err({ code: "unavailable", message: "Down", retryable: true }))
        : new FakeLlmClient().reply(answer()).complete(request),
  };
  return { client, fail: () => (failing = true) };
};

describeCampaignPlannerContract("StrategistAgent (scripted model)", () => {
  const model = scriptedModel(modelPlan);
  return { planner: new StrategistAgent(model.client), givenFailure: () => void model.fail() };
});

const reviewerHarness = (make: () => ContentReviewer) => () => {
  const reviewer = make();
  let failing = false;
  return {
    reviewer: {
      review: (request) => reviewer.review(failing ? { ...request, body: "" } : request),
    } satisfies ContentReviewer,
    givenFailure: () => {
      failing = true;
    },
  };
};

describeContentReviewerContract(
  "TemplateReviewer",
  reviewerHarness(() => new TemplateReviewer()),
);

describeContentReviewerContract(
  "ReviewerAgent (scripted model)",
  reviewerHarness(
    () =>
      new ReviewerAgent(
        scriptedModel(() => JSON.stringify({ decision: "pass", issues: [] })).client,
      ),
  ),
);
