import { describe, expect, it } from "vitest";
import { userId } from "../shared/ids";
import { isActive, SESSION_LIFETIME_DAYS, startSession } from "./session";

const now = new Date("2026-05-01T12:00:00.000Z");
const session = startSession({ token: "tok_1", userId: userId("user_1"), now });
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

describe("session", () => {
  it("lasts 30 days from when it starts", () => {
    expect(SESSION_LIFETIME_DAYS).toBe(30);
    expect(session).toEqual({
      token: "tok_1",
      userId: "user_1",
      createdAt: now,
      expiresAt: days(30),
    });
  });

  it("is active before it expires", () => {
    expect(isActive(session, days(29))).toBe(true);
  });

  it("is inactive from the moment it expires", () => {
    expect(isActive(session, days(30))).toBe(false);
    expect(isActive(session, days(31))).toBe(false);
  });
});
