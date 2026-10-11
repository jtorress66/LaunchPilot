import { FixedClock } from "@launchpilot/testing";
import { describe, expect, it } from "vitest";
import { createHealthHandler } from "./health-handler";

describe("health handler", () => {
  const clock = new FixedClock(new Date("2026-02-02T08:00:00.000Z"));
  const handle = createHealthHandler({ clock, version: "9.9.9" });

  it("responds 200 with an ok health report using the injected clock", async () => {
    const response = handle();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "web",
      version: "9.9.9",
      checkedAt: "2026-02-02T08:00:00.000Z",
    });
  });

  it("sets a JSON content type and disables caching", () => {
    const response = handle();
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
