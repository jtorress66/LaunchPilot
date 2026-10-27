import { describe, expect, it } from "vitest";
import type { ContentItem } from "../content-item/content-item";
import { linksOutside, publishedArticles, unlinkOutside } from "./internal-links";

const item = (
  title: string,
  overrides: { channel?: ContentItem["channel"]; url?: string; at?: string } = {},
) =>
  ({
    title,
    channel: overrides.channel ?? "blog",
    publication:
      overrides.url === undefined
        ? null
        : { externalUrl: overrides.url, at: new Date(overrides.at ?? "2026-10-01T00:00:00Z") },
  }) as ContentItem;

describe("publishedArticles", () => {
  it("lists the product's published blog articles, newest first", () => {
    const items = [
      item("Old", { url: "https://acme.dev/old", at: "2026-09-01T00:00:00Z" }),
      item("Draft"),
      item("A post", { channel: "x", url: "https://x.com/acme/1" }),
      item("New", { url: "https://acme.dev/new", at: "2026-10-10T00:00:00Z" }),
    ];
    expect(publishedArticles(items)).toEqual([
      { title: "New", url: "https://acme.dev/new" },
      { title: "Old", url: "https://acme.dev/old" },
    ]);
  });

  it("offers at most a handful of articles", () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      item(`A${String(i)}`, { url: `https://acme.dev/${String(i)}` }),
    );
    expect(publishedArticles(items)).toHaveLength(10);
    expect(publishedArticles(items, 3)).toHaveLength(3);
  });
});

const allowed = [{ title: "Old", url: "https://acme.dev/old" }];

describe("linksOutside", () => {
  it("names every link that is not one of the allowed articles", () => {
    const body =
      "See [our guide](https://acme.dev/old) and [a rival](https://rival.io/x), [here](/pricing).";
    expect(linksOutside(body, allowed)).toEqual(["https://rival.io/x", "/pricing"]);
  });

  it("counts bare URLs too", () => {
    expect(linksOutside("Visit https://rival.io today.", allowed)).toEqual(["https://rival.io"]);
  });

  it("is empty for a body that links only to allowed articles, or not at all", () => {
    expect(linksOutside("Read [this](https://acme.dev/old).", allowed)).toEqual([]);
    expect(linksOutside("No links here.", [])).toEqual([]);
  });
});

describe("unlinkOutside", () => {
  it("keeps allowed links and turns the rest into plain text", () => {
    const body =
      "See [our guide](https://acme.dev/old), [a rival](https://rival.io/x) and https://spam.example.";
    expect(unlinkOutside(body, allowed)).toBe(
      "See [our guide](https://acme.dev/old), a rival and spam.example.",
    );
  });
});
