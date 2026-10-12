import type { BriefDrafter } from "@launchpilot/ports";
import { FakeLlmClient } from "@launchpilot/testing";
import {
  briefDrafterContractSite,
  describeBriefDrafterContract,
} from "@launchpilot/testing/contracts";
import { BriefAgent, ExtractiveBriefDrafter } from "../src";

describeBriefDrafterContract("ExtractiveBriefDrafter", () => ({
  drafter: new ExtractiveBriefDrafter(),
  givenFailure: () => ({
    productName: "Acme",
    site: { url: briefDrafterContractSite.url, pages: [] },
  }),
}));

/** A plausible model answer, including one claim the site does not support. */
const modelReply = JSON.stringify({
  audience: "SaaS founders",
  problem: "Bloated dashboards answer nothing",
  solution: "Five numbers in one weekly email",
  differentiators: ["No cookie banners"],
  tone: "Plain",
  facts: [
    { statement: "Free 14-day trial", quote: "free 14-day trial" },
    { statement: "Used by Fortune 500 companies", quote: "Fortune 500" },
  ],
});

describeBriefDrafterContract("BriefAgent with a scripted model", () => {
  const llm = new FakeLlmClient();
  const agent = new BriefAgent(llm);
  let outage = false;
  const drafter: BriefDrafter = {
    draft: (request) => {
      if (outage) {
        llm.fail({ code: "unavailable", message: "Overloaded", retryable: true });
      } else {
        llm.reply(modelReply);
      }
      return agent.draft(request);
    },
  };
  return {
    drafter,
    givenFailure: () => {
      outage = true;
      return undefined;
    },
  };
});
