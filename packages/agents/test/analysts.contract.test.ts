import { FakeLlmClient } from "@launchpilot/testing";
import { describeWeeklyReportAnalystContract } from "@launchpilot/testing/contracts";
import { AnalystAgent, TemplateAnalyst } from "../src";

describeWeeklyReportAnalystContract("TemplateAnalyst", () => new TemplateAnalyst());

/** A plausible model answer that also cites a fact the brief does not have. */
const modelReply = JSON.stringify({
  summary: "Visitors rose 20% to 1,200 and search clicks rose 20% to 120.",
  highlights: ["/pricing had 210 visitors."],
  suggestions: ['Write a post that answers "cookieless analytics".'],
  citedFacts: ["Free 14-day trial", "Trusted by 10,000 teams"],
});

describeWeeklyReportAnalystContract(
  "AnalystAgent (FakeLlmClient)",
  () => new AnalystAgent(new FakeLlmClient().reply(modelReply).reply(modelReply)),
);
