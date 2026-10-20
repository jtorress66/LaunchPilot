import { aBriefContent } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { draftBlockers } from "./draft-checks";

const brief = aBriefContent({ facts: ["Free 14-day trial", "Starter is $9 per month"] });
const request = (body: string, extra: { channel?: "x" | "blog"; link?: string } = {}) => ({
  brief,
  channel: extra.channel ?? ("x" as const),
  title: "Why cookies hurt",
  body,
  ...(extra.link === undefined ? {} : { link: extra.link }),
});

describe("draftBlockers", () => {
  it("finds nothing wrong with a short post that states only the brief's facts", () => {
    expect(draftBlockers(request("Try it free for 14 days. Starter is $9 per month."))).toEqual([]);
  });

  it.each([
    [
      "over the channel's limit",
      request("a".repeat(281)),
      "The text is 281 characters; x allows 280.",
    ],
    [
      "without the required link",
      request("Read the guide.", { link: "https://acme.dev/blog/guide" }),
      "Include the link https://acme.dev/blog/guide.",
    ],
    ["with hype", request("The revolutionary analytics tool."), 'Remove hype: "revolutionary".'],
    [
      "with a figure the brief does not have",
      request("Trusted by 10,000 teams, 40% faster."),
      "These figures are not in the brief: 10,000, 40.",
    ],
  ])("blocks a draft %s", (_case, draft, message) => {
    expect(draftBlockers(draft)).toContainEqual({ severity: "blocker", message });
  });

  it("allows small counts, the year and figures inside the required link", () => {
    expect(
      draftBlockers(
        request("3 reasons to switch in 2026: https://acme.dev/blog/2026-guide-42", {
          link: "https://acme.dev/blog/2026-guide-42",
        }),
      ),
    ).toEqual([]);
  });
});
