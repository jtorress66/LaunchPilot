import { maxLengthOf } from "@launchpilot/domain";
import type { DraftRequest } from "@launchpilot/ports";
import { aBriefContent } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { TemplatePostWriter } from "./template-post-writer";

const request: DraftRequest = {
  brief: aBriefContent(),
  channel: "x",
  task: { kind: "social_post", title: "Worth knowing: Free 14-day trial" },
};

const draft = async (req: DraftRequest = request) => {
  const result = await new TemplatePostWriter().draft(req);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("TemplatePostWriter", () => {
  it("writes a post titled after its angle that states the angle and the solution", async () => {
    const post = await draft();
    expect(post.title).toBe("Worth knowing: Free 14-day trial");
    expect(post.body).toContain("Worth knowing: Free 14-day trial");
    expect(post.body).toContain(request.brief.solution);
  });

  it("cites the brief facts the post states, verbatim", async () => {
    expect((await draft()).citedFacts).toEqual(["Free 14-day trial"]);
  });

  it("ends with the link when one is given, and stays within the X limit", async () => {
    const link = "https://blog.acme.dev/a-very-long-article-slug";
    const post = await draft({
      ...request,
      brief: { ...request.brief, solution: "word ".repeat(100).trim() },
      link,
    });
    expect(post.body.endsWith(link)).toBe(true);
    expect(post.body.length).toBeLessThanOrEqual(maxLengthOf("x"));
  });

  it("is deterministic", async () => {
    expect(await draft()).toEqual(await draft());
  });

  it("fails without an angle", async () => {
    const result = await new TemplatePostWriter().draft({
      ...request,
      task: { kind: "social_post", title: " " },
    });
    expect(result.ok ? undefined : result.error.code).toBe("generation_failed");
  });
});
