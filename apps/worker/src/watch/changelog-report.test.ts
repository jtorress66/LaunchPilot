import { describe, expect, it } from "vitest";
import { toIssue, type FlaggedChange } from "./changelog-report";

const change: FlaggedChange = {
  id: "chg_posts_field_removed",
  type: "breaking_change",
  impact: "action_required",
  url: "https://docs.zernio.com/changelog#chg_posts_field_removed",
  publishedAt: "2026-10-11T09:00:00.000Z",
  message: "**Posts:** `platformPostUrl` moves to `post.results[]`.\n\nThanks @zernio-team!",
  reasons: ["Changes POST /v1/posts, which Nuvantre calls", "Needs action on X"],
};

describe("toIssue", () => {
  it("titles the issue with the entry's first line, plain, and its id for de-duplication", () => {
    expect(toIssue(change).title).toBe(
      "Zernio API change: Posts: platformPostUrl moves to post.results[]. [chg_posts_field_removed]",
    );
  });

  it("keeps long titles short", () => {
    const title = toIssue({ ...change, message: "a".repeat(300) }).title;
    expect(title.length).toBeLessThanOrEqual(140);
    expect(title.endsWith("[chg_posts_field_removed]")).toBe(true);
  });

  it("explains why it matters, links the entry and quotes it without pinging anyone", () => {
    const { body } = toIssue(change);
    expect(body).toContain("- Changes POST /v1/posts, which Nuvantre calls\n- Needs action on X");
    expect(body).toContain("breaking_change · impact: action_required · published 2026-10-11");
    expect(body).toContain(change.url);
    expect(body).toContain("> **Posts:**");
    expect(body).not.toContain("@zernio-team");
    expect(body).toContain("packages/adapters/src/zernio");
  });
});
