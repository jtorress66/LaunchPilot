import { describe, expect, it } from "vitest";
import { buildHealthReport } from "./health";

describe("buildHealthReport", () => {
  const now = new Date("2026-01-15T09:30:00.000Z");

  it("reports status ok with the injected time as an ISO string", () => {
    const report = buildHealthReport({ service: "web", version: "0.1.0", now });
    expect(report.status).toBe("ok");
    expect(report.checkedAt).toBe("2026-01-15T09:30:00.000Z");
  });

  it("includes the service name and version", () => {
    const report = buildHealthReport({ service: "worker", version: "1.2.3", now });
    expect(report).toEqual({
      status: "ok",
      service: "worker",
      version: "1.2.3",
      checkedAt: "2026-01-15T09:30:00.000Z",
    });
  });
});
