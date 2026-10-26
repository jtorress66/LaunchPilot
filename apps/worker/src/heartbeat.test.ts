import { FixedClock } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { createHeartbeat } from "./heartbeat";

describe("worker heartbeat", () => {
  const setup = () => {
    const clock = new FixedClock(new Date("2026-05-05T05:05:05.000Z"));
    const lines: string[] = [];
    const heartbeat = createHeartbeat({ clock, version: "0.1.0", log: (line) => lines.push(line) });
    return { clock, lines, heartbeat };
  };

  it("tick returns a health report stamped with the clock's time", () => {
    const { heartbeat } = setup();
    expect(heartbeat.tick()).toEqual({
      status: "ok",
      service: "worker",
      version: "0.1.0",
      checkedAt: "2026-05-05T05:05:05.000Z",
    });
  });

  it("logs one structured JSON line per tick", () => {
    const { clock, lines, heartbeat } = setup();
    heartbeat.tick();
    clock.advance(60_000);
    heartbeat.tick();
    expect(lines).toHaveLength(2);
    const parsed: unknown = JSON.parse(lines[1] ?? "");
    expect(parsed).toMatchObject({
      event: "worker.heartbeat",
      checkedAt: "2026-05-05T05:06:05.000Z",
    });
  });
});
