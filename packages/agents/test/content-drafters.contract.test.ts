import type { ContentDrafter } from "@nuvantre/ports";
import { aListing, FakeLlmClient } from "@nuvantre/testing";
import {
  describeContentDrafterContract,
  describeLaunchKitDrafterContract,
} from "@nuvantre/testing/contracts";
import {
  SeoArticleWriter,
  SocialPostWriter,
  TemplateArticleWriter,
  TemplatePostWriter,
  LaunchKitWriter,
  TemplateLaunchKitWriter,
} from "../src";

describeContentDrafterContract("TemplateArticleWriter", () => {
  const writer = new TemplateArticleWriter();
  let failing = false;
  const drafter: ContentDrafter = {
    // The template writer cannot fail on valid input; a blank task title is its only failure.
    draft: (request) =>
      writer.draft(
        failing ? { ...request, task: { ...request.task, title: " " }, keywords: [] } : request,
      ),
  };
  return {
    drafter,
    givenFailure: () => {
      failing = true;
    },
  };
});

/** A plausible model answer that also cites a fact the brief does not have. */
const modelReply = JSON.stringify({
  title: "SaaS marketing for solo founders",
  body: "## Why saas marketing is hard\n\nIt takes time.\n\n## What helps\n\nA Free 14-day trial.",
  citedFacts: ["Free 14-day trial", "Trusted by 10,000 teams"],
});

describeContentDrafterContract("SeoArticleWriter with a scripted model", () => {
  const llm = new FakeLlmClient();
  const writer = new SeoArticleWriter(llm);
  let outage = false;
  const drafter: ContentDrafter = {
    draft: (request) => {
      if (outage) llm.fail({ code: "unavailable", message: "Overloaded", retryable: true });
      else llm.reply(modelReply);
      return writer.draft(request);
    },
  };
  return {
    drafter,
    givenFailure: () => {
      outage = true;
    },
  };
});

describeContentDrafterContract("TemplatePostWriter", () => {
  const writer = new TemplatePostWriter();
  let failing = false;
  const drafter: ContentDrafter = {
    // A blank angle is the template writer's only failure.
    draft: (request) =>
      writer.draft(failing ? { ...request, task: { ...request.task, title: " " } } : request),
  };
  return {
    drafter,
    givenFailure: () => {
      failing = true;
    },
  };
});

describeContentDrafterContract("SocialPostWriter with a scripted model", () => {
  const llm = new FakeLlmClient();
  const writer = new SocialPostWriter(llm);
  let outage = false;
  const drafter: ContentDrafter = {
    draft: (request) => {
      if (outage) llm.fail({ code: "unavailable", message: "Overloaded", retryable: true });
      else
        llm.reply(
          JSON.stringify({
            text: "Marketing on autopilot. Free 14-day trial.",
            citedFacts: ["Free 14-day trial", "Trusted by 10,000 teams"],
          }),
        );
      return writer.draft(request);
    },
  };
  return {
    drafter,
    givenFailure: () => {
      outage = true;
    },
  };
});

describeLaunchKitDrafterContract("TemplateLaunchKitWriter", () => {
  const writer = new TemplateLaunchKitWriter();
  let failing = false;
  return {
    drafter: {
      // A blank product name is the template writer's only failure.
      draft: (request) =>
        writer.draft(
          failing ? { ...request, product: { ...request.product, name: " " } } : request,
        ),
    },
    givenFailure: () => {
      failing = true;
    },
  };
});

describeLaunchKitDrafterContract("LaunchKitWriter with a scripted model", () => {
  const llm = new FakeLlmClient();
  const writer = new LaunchKitWriter(llm);
  let outage = false;
  return {
    drafter: {
      draft: (request) => {
        if (outage) llm.fail({ code: "unavailable", message: "Overloaded", retryable: true });
        else
          llm.reply(
            JSON.stringify({
              listing: aListing(),
              community: {
                hackernews: { title: "Show HN: Acme", body: "Feedback welcome." },
                reddit: { title: "I built Acme", body: "Free 14-day trial." },
                indiehackers: { title: "Launching Acme", body: "Our story." },
              },
              citedFacts: ["Free 14-day trial", "Trusted by 10,000 teams"],
            }),
          );
        return writer.draft(request);
      },
    },
    givenFailure: () => {
      outage = true;
    },
  };
});
