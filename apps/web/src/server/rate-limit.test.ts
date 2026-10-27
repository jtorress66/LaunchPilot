import { FixedClock, InMemoryRateLimiter } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import { clientAddress, createRateGuard } from "./rate-limit";

const headers = (values: Record<string, string>) => new Headers(values);

describe("clientAddress", () => {
  it("takes the first X-Forwarded-For address behind a trusted proxy", () => {
    expect(clientAddress(headers({ "x-forwarded-for": " 203.0.113.7, 10.0.0.2" }), true)).toBe(
      "203.0.113.7",
    );
  });

  it("ignores forwarding headers a client could forge when no proxy is trusted", () => {
    expect(clientAddress(headers({ "x-forwarded-for": "203.0.113.7" }), false)).toBe("direct");
    expect(clientAddress(headers({}), true)).toBe("direct");
  });
});

describe("createRateGuard", () => {
  const setUp = (overrides = {}) => {
    const clock = new FixedClock(new Date("2026-10-28T09:00:00.000Z"));
    return createRateGuard({ limiter: new InMemoryRateLimiter(clock), overrides });
  };

  it("lets attempts through up to the policy's limit, then says how long to wait", async () => {
    const guard = setUp();
    for (let i = 0; i < 5; i++) {
      expect(await guard("signup", "203.0.113.7")).toEqual({ allowed: true });
    }
    expect(await guard("signup", "203.0.113.7")).toEqual({
      allowed: false,
      retryAfterSeconds: 3600,
      message: "Too many attempts. Try again in 60 minutes.",
    });
  });

  it("counts each key separately", async () => {
    const guard = setUp();
    for (let i = 0; i < 5; i++) await guard("signup", "203.0.113.7");
    expect(await guard("signup", "198.51.100.1")).toEqual({ allowed: true });
  });

  it("uses a raised limit from configuration", async () => {
    const guard = setUp({ signup: 6 });
    for (let i = 0; i < 6; i++) await guard("signup", "203.0.113.7");
    expect(await guard("signup", "203.0.113.7")).toMatchObject({ allowed: false });
  });
});
