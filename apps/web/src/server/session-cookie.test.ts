import { describe, expect, it } from "vitest";
import { SESSION_COOKIE, sessionCookieOptions } from "./session-cookie";

const expiresAt = new Date("2026-06-01T00:00:00.000Z");

describe("session cookie", () => {
  it("is httpOnly, SameSite=Lax, site-wide and expires with the session", () => {
    expect(SESSION_COOKIE).toBe("lp_session");
    expect(sessionCookieOptions("http://localhost:3000", expiresAt)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      expires: expiresAt,
    });
  });

  it("is Secure when the app is served over https", () => {
    expect(sessionCookieOptions("https://launchpilot.app", expiresAt).secure).toBe(true);
  });
});
