import { FakeReadinessProbe } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { createReadinessHandler } from "./readiness-handler";

describe("readiness handler", () => {
  it("answers 200 when every dependency is ready", async () => {
    const response = await createReadinessHandler([new FakeReadinessProbe("database")])();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "ready",
      checks: [{ name: "database", ready: true }],
    });
  });

  it("answers 503 with the reason when a dependency is not ready", async () => {
    const response = await createReadinessHandler([
      new FakeReadinessProbe("database").failWith("The database could not be reached"),
    ])();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "not_ready",
      checks: [{ name: "database", ready: false, reason: "The database could not be reached" }],
    });
  });
});
