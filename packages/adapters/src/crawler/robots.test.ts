import { describe, expect, it } from "vitest";
import { parseRobots } from "./robots";

const AGENT = "NuvantreBot";

describe("parseRobots", () => {
  it("allows everything when robots.txt is empty", () => {
    expect(parseRobots("", AGENT)("/anything")).toBe(true);
  });

  it("applies the * group when no group names our bot", () => {
    const allowed = parseRobots("User-agent: *\nDisallow: /admin\n", AGENT);
    expect(allowed("/admin/users")).toBe(false);
    expect(allowed("/pricing")).toBe(true);
  });

  it("prefers a group naming our bot over the * group", () => {
    const robots = [
      "User-agent: *",
      "Disallow: /",
      "",
      "User-agent: nuvantrebot",
      "Disallow: /private",
    ].join("\n");
    const allowed = parseRobots(robots, AGENT);
    expect(allowed("/pricing")).toBe(true);
    expect(allowed("/private/x")).toBe(false);
  });

  it("lets the longest matching rule win, with Allow winning a tie", () => {
    const robots = "User-agent: *\nDisallow: /docs\nAllow: /docs/public\nAllow: /a\nDisallow: /a\n";
    const allowed = parseRobots(robots, AGENT);
    expect(allowed("/docs/internal")).toBe(false);
    expect(allowed("/docs/public/intro")).toBe(true);
    expect(allowed("/a")).toBe(true);
  });

  it("supports * and $ wildcards and ignores comments and unknown lines", () => {
    const robots =
      "# hi\nUser-agent: * # everyone\nDisallow: /*.pdf$\nSitemap: https://x.dev/s.xml\nCrawl-delay: 5\n";
    const allowed = parseRobots(robots, AGENT);
    expect(allowed("/files/guide.pdf")).toBe(false);
    expect(allowed("/files/guide.pdf?x=1")).toBe(true);
  });

  it("treats an empty Disallow as allowing everything", () => {
    expect(parseRobots("User-agent: *\nDisallow:\n", AGENT)("/x")).toBe(true);
  });

  it("shares rules between consecutive user-agent lines", () => {
    const robots = "User-agent: otherbot\nUser-agent: NuvantreBot\nDisallow: /beta\n";
    expect(parseRobots(robots, AGENT)("/beta")).toBe(false);
  });
});
