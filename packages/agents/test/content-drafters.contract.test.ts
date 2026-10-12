import type { ContentDrafter } from "@launchpilot/ports";
import { FakeLlmClient } from "@launchpilot/testing";
import { describeContentDrafterContract } from "@launchpilot/testing/contracts";
import { SeoArticleWriter, SocialPostWriter, TemplateArticleWriter, TemplatePostWriter } from "../src";

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
