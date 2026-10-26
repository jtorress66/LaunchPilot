import { contentItemStatuses, toPublishable } from "@nuvantre/domain";
import { describe, expect, it } from "vitest";
import {
  aBrief,
  aCampaign,
  aContentItem,
  aProduct,
  aPublishableItem,
  aTask,
  aWorkspace,
} from "./entities";

describe("fixtures", () => {
  it("build valid entities with sensible defaults", () => {
    expect(aWorkspace().name).toBe("Acme Labs");
    expect(aProduct().url).toBe("https://acme.dev/");
    expect(aBrief().content.facts.length).toBeGreaterThan(0);
    expect(aCampaign().status).toBe("planned");
    expect(aTask().status).toBe("todo");
    expect(aContentItem().status).toBe("draft");
  });

  it("apply overrides", () => {
    expect(aProduct({ name: "Other" }).name).toBe("Other");
    expect(aBrief({ status: "approved" }).approval).not.toBeNull();
  });

  it.each(contentItemStatuses)("reach a %s content item through real transitions", (status) => {
    expect(aContentItem({ status }).status).toBe(status);
  });

  it("refuse to build a published item on a draft-only channel", () => {
    expect(() => aContentItem({ channel: "reddit", status: "published" })).toThrow();
  });

  it("build publishable items only through the domain gate", () => {
    const item = aPublishableItem("linkedin");
    expect(toPublishable(item)).toEqual({ ok: true, value: item });
  });
});
