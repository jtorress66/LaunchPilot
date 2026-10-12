import { productId } from "@launchpilot/domain";
import { FakePublisherProvider } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { PublisherRegistry } from "../src";

describe("PublisherRegistry", () => {
  it("hands out the publisher of the provider registered for the channel", async () => {
    const blog = new FakePublisherProvider("blog").connect(productId("prod_1"));
    const result = await new PublisherRegistry([blog]).forProduct("blog", productId("prod_1"));
    expect(result.ok && result.value).toBe(blog.publisher);
  });

  it("reports a channel nobody has registered a provider for as not connected", async () => {
    const result = await new PublisherRegistry([]).forProduct("linkedin", productId("prod_1"));
    expect(result).toEqual({
      ok: false,
      error: {
        code: "not_connected",
        message: "Publishing to linkedin is not available yet",
        retryable: false,
      },
    });
  });
});
