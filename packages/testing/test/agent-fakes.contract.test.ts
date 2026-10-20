import {
  describeBriefDrafterContract,
  describeCampaignPlannerContract,
  describeContentDrafterContract,
  describeContentReviewerContract,
  describeLaunchKitDrafterContract,
  describeLlmClientContract,
  describeWeeklyReportAnalystContract,
} from "../contracts";
import {
  FakeBriefDrafter,
  FakeCampaignPlanner,
  FakeContentDrafter,
  FakeContentReviewer,
  FakeLaunchKitDrafter,
  FakeLlmClient,
  FakeWeeklyReportAnalyst,
} from "../src";

const outage = { message: "Simulated outage", retryable: true } as const;

describeLlmClientContract("FakeLlmClient", () => {
  const client = new FakeLlmClient();
  return {
    client,
    givenReply: (text) => {
      client.reply(text);
    },
    givenOutage: () => {
      client.fail({ code: "unavailable", ...outage });
    },
  };
});

describeContentDrafterContract("FakeContentDrafter", () => {
  const drafter = new FakeContentDrafter();
  return {
    drafter,
    givenFailure: () => {
      drafter.failNext({ code: "unavailable", ...outage });
    },
  };
});

describeContentReviewerContract("FakeContentReviewer", () => {
  const reviewer = new FakeContentReviewer();
  return {
    reviewer,
    givenFailure: () => {
      reviewer.failNext({ code: "unavailable", ...outage });
    },
  };
});

describeCampaignPlannerContract("FakeCampaignPlanner", () => {
  const planner = new FakeCampaignPlanner();
  return {
    planner,
    givenFailure: () => {
      planner.failNext({ code: "unavailable", ...outage });
    },
  };
});

describeBriefDrafterContract("FakeBriefDrafter", () => {
  const drafter = new FakeBriefDrafter();
  return {
    drafter,
    givenFailure: () => {
      drafter.failNext({ code: "unavailable", ...outage });
      return undefined;
    },
  };
});

describeLaunchKitDrafterContract("FakeLaunchKitDrafter", () => {
  const drafter = new FakeLaunchKitDrafter();
  return {
    drafter,
    givenFailure: () => {
      drafter.failNext({ code: "unavailable", message: "Busy", retryable: true });
    },
  };
});

describeWeeklyReportAnalystContract("FakeWeeklyReportAnalyst", () => new FakeWeeklyReportAnalyst());
