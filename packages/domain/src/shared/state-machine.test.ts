import { describe, expect, it } from "vitest";
import { applyTransition, defineTransitions } from "./state-machine";

type Light = "red" | "green" | "yellow";
type Signal = "go" | "slow" | "stop";

const machine = defineTransitions<Light, Signal>({
  red: { go: "green" },
  green: { slow: "yellow" },
  yellow: { stop: "red" },
});

describe("state machine", () => {
  it("moves to the next state for an allowed event", () => {
    expect(applyTransition(machine, "red", "go")).toEqual({ ok: true, value: "green" });
  });

  it("rejects an event that is not allowed from the current state", () => {
    expect(applyTransition(machine, "red", "stop")).toEqual({
      ok: false,
      error: { code: "invalid_transition", message: 'Cannot "stop" from "red"' },
    });
  });

  it("reports whether an event is allowed without applying it", () => {
    expect(machine.can("green", "slow")).toBe(true);
    expect(machine.can("green", "go")).toBe(false);
  });
});
