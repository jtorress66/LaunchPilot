import { describe, expect, it } from "vitest";
import { createProduct } from "../product/product";
import { productId, workspaceId } from "../shared/ids";
import { disableAutopilot, enableAutopilot, loopIsDue, loopWeekOf } from "./autopilot";

const now = new Date("2026-10-20T09:00:00.000Z");
const product = () => {
  const created = createProduct({
    id: productId("prod_1"),
    workspaceId: workspaceId("ws_1"),
    name: "Acme",
    url: "https://acme.dev",
    now,
  });
  if (!created.ok) throw new Error(created.error.message);
  return created.value;
};

describe("autopilot", () => {
  it("starts off, and remembers when it was switched on", () => {
    expect(product().autopilotSince).toBeNull();
    const on = enableAutopilot(product(), now);
    expect(on.autopilotSince).toEqual(now);
    expect(enableAutopilot(on, new Date("2026-11-01T00:00:00.000Z")).autopilotSince).toEqual(now);
    expect(disableAutopilot(on).autopilotSince).toBeNull();
  });
});

describe("weekly loop timing", () => {
  it.each([
    ["Monday 07:00", "2026-10-19T07:00:00.000Z"],
    ["Sunday night", "2026-10-25T23:59:59.000Z"],
  ])("plans the week starting that Monday (%s)", (_case, time) => {
    expect(loopWeekOf(new Date(time))).toEqual({
      start: new Date("2026-10-19T00:00:00.000Z"),
      end: new Date("2026-10-26T00:00:00.000Z"),
    });
  });

  it.each([
    ["2026-10-19T06:59:59.000Z", false],
    ["2026-10-19T07:00:00.000Z", true],
    ["2026-10-21T12:00:00.000Z", true],
  ])("is due at %s: %s", (time, due) => {
    expect(loopIsDue(new Date(time))).toBe(due);
  });
});
