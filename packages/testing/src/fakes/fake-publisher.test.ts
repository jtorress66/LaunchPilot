import { describe, expect, it } from "vitest";
import { aPublishableItem } from "../fixtures/entities";
import { FakePublisher } from "./fake-publisher";
import { FixedClock } from "./fixed-clock";

describe("FakePublisher", () => {
  it("records what it published and stamps the receipt with its clock", async () => {
    const clock = new FixedClock(new Date("2026-04-01T12:00:00.000Z"));
    const publisher = new FakePublisher("x", clock);
    const item = aPublishableItem("x");
    expect(await publisher.publish(item)).toEqual({
      ok: true,
      value: {
        channel: "x",
        externalUrl: `https://example.com/x/${item.id}`,
        publishedAt: clock.now(),
      },
    });
    expect(publisher.published).toEqual([item]);
  });

  it("fails only the next call when told to", async () => {
    const publisher = new FakePublisher("blog");
    publisher.failNext({ code: "not_connected", message: "Connect your blog", retryable: false });
    expect((await publisher.publish(aPublishableItem("blog"))).ok).toBe(false);
    expect((await publisher.publish(aPublishableItem("blog"))).ok).toBe(true);
    expect(publisher.published).toHaveLength(1);
  });
});
