import { describe, expect, it } from "vitest";
import { pickLinks } from "./link-picker";

const home = "https://acme.dev/";

describe("pickLinks", () => {
  it("keeps same-origin pages only, resolving relative links", () => {
    expect(
      pickLinks(
        home,
        ["/blog/post", "https://other.dev/pricing", "mailto:hi@acme.dev", "http://acme.dev/x"],
        5,
      ),
    ).toEqual(["https://acme.dev/blog/post"]);
  });

  it("puts pages that describe the product first", () => {
    expect(pickLinks(home, ["/blog", "/careers", "/about", "/pricing", "/features"], 3)).toEqual([
      "https://acme.dev/pricing",
      "https://acme.dev/features",
      "https://acme.dev/about",
    ]);
  });

  it("drops fragments, duplicates, the home page and files that are not pages", () => {
    expect(
      pickLinks(
        home,
        ["/pricing#plans", "/pricing", "/", "#top", "/logo.png", "/guide.pdf", "/terms?ref=1"],
        10,
      ),
    ).toEqual(["https://acme.dev/pricing", "https://acme.dev/terms?ref=1"]);
  });

  it("ignores links that cannot be parsed", () => {
    expect(pickLinks(home, ["http://[bad", "/ok"], 10)).toEqual(["https://acme.dev/ok"]);
  });

  it("stops at the limit", () => {
    expect(pickLinks(home, ["/a", "/b", "/c"], 2)).toHaveLength(2);
  });
});
