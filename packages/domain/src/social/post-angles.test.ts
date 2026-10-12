import { describe, expect, it } from "vitest";
import { planPostAngles } from "./post-angles";

const brief = {
  audience: "Solo SaaS founders",
  problem: "Marketing takes time away from building",
  solution: "Privacy-friendly analytics with weekly insights",
  differentiators: ["No cookies", "Setup in two minutes"],
  tone: "Friendly",
  facts: ["Free 14-day trial", "GDPR compliant", "Integrates with Search Console"],
};

describe("planPostAngles", () => {
  it("plans the requested number of posts per channel, from differentiators and facts", () => {
    const angles = planPostAngles(brief, { x: 3, linkedin: 2 });
    expect(angles.filter((a) => a.channel === "x")).toHaveLength(3);
    expect(angles.filter((a) => a.channel === "linkedin")).toHaveLength(2);
    expect(angles[0]).toEqual({
      channel: "x",
      angle: "Why it matters: No cookies",
      link: null,
    });
  });

  it("leads with the latest published article on both channels", () => {
    const angles = planPostAngles(brief, {
      x: 2,
      linkedin: 1,
      latestArticle: { title: "Cookieless analytics guide", url: "https://blog.acme.dev/guide" },
    });
    expect(angles.map((a) => [a.channel, a.angle, a.link])).toEqual([
      ["x", "New article: Cookieless analytics guide", "https://blog.acme.dev/guide"],
      ["x", "Why it matters: No cookies", null],
      ["linkedin", "New article: Cookieless analytics guide", "https://blog.acme.dev/guide"],
    ]);
  });

  it("is deterministic and falls back to the problem and solution without differentiators or facts", () => {
    const bare = { ...brief, differentiators: [], facts: [] };
    const angles = planPostAngles(bare, { x: 2, linkedin: 1 });
    expect(angles.map((a) => a.angle)).toEqual([
      "The problem: Marketing takes time away from building",
      "How we solve it: Privacy-friendly analytics with weekly insights",
      "The problem: Marketing takes time away from building",
    ]);
    expect(planPostAngles(bare, { x: 2, linkedin: 1 })).toEqual(angles);
  });
});
