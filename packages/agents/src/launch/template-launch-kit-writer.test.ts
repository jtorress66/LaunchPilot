import { validateListing } from "@launchpilot/domain";
import type { LaunchKitRequest } from "@launchpilot/ports";
import { aBriefContent } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { TemplateLaunchKitWriter } from "./template-launch-kit-writer";

const request: LaunchKitRequest = {
  brief: aBriefContent(),
  product: { name: "Acme Analytics", url: "https://acme.dev/" },
};

const draft = async (req: LaunchKitRequest = request) => {
  const result = await new TemplateLaunchKitWriter().draft(req);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("TemplateLaunchKitWriter", () => {
  it("names the listing after the product and fills every field within its limit", async () => {
    const { listing } = await draft();
    expect(listing.name).toBe("Acme Analytics");
    expect(validateListing(listing).ok).toBe(true);
  });

  it("builds features from differentiators and facts, verbatim, and cites the facts it uses", async () => {
    const { listing, citedFacts } = await draft();
    expect(listing.features).toEqual([
      "No cookies",
      "Setup in two minutes",
      "Free 14-day trial",
      "GDPR compliant",
      "Integrates with Search Console",
    ]);
    expect(citedFacts).toEqual([
      "Free 14-day trial",
      "GDPR compliant",
      "Integrates with Search Console",
    ]);
  });

  it("stays within limits and has 3 features even for a long, bare brief", async () => {
    const long = "word ".repeat(400).trim();
    const { listing } = await draft({
      ...request,
      brief: aBriefContent({ solution: long, problem: long, differentiators: [], facts: [] }),
    });
    expect(validateListing(listing).ok).toBe(true);
  });

  it("drafts a Show HN post with the HN prefix, plus Reddit and Indie Hackers posts", async () => {
    const { community } = await draft();
    expect(community.map((c) => c.channel)).toEqual(["hackernews", "reddit", "indiehackers"]);
    expect(community[0]?.title.startsWith("Show HN: Acme Analytics")).toBe(true);
    expect(community[0]?.body).toContain("https://acme.dev/");
  });

  it("is deterministic", async () => {
    expect(await draft()).toEqual(await draft());
  });

  it("fails without a product name", async () => {
    const result = await new TemplateLaunchKitWriter().draft({
      ...request,
      product: { ...request.product, name: " " },
    });
    expect(result.ok ? undefined : result.error.code).toBe("generation_failed");
  });
});
