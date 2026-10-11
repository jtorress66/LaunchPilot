import { describe, expect, it } from "vitest";
import { channels, isAutoPublishable } from "./channel";

describe("channels", () => {
  it.each(["reddit", "hackernews", "indiehackers"] as const)(
    "%s is draft-only and never auto-published",
    (channel) => {
      expect(isAutoPublishable(channel)).toBe(false);
    },
  );

  it.each(["blog", "x", "linkedin"] as const)("%s can be published through its API", (channel) => {
    expect(isAutoPublishable(channel)).toBe(true);
  });

  it("defines a publishing policy for every channel", () => {
    expect(channels).toEqual([
      "blog",
      "x",
      "linkedin",
      "producthunt",
      "directory",
      "reddit",
      "hackernews",
      "indiehackers",
    ]);
    for (const channel of channels) expect(typeof isAutoPublishable(channel)).toBe("boolean");
  });
});

describe("manual channels", () => {
  it.each(["producthunt", "directory"] as const)(
    "%s submissions are prepared as kits, not auto-published",
    (channel) => {
      expect(isAutoPublishable(channel)).toBe(false);
    },
  );
});
