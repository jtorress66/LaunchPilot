import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  sessionCookieName,
  sessionCookieNames,
  sessionCookieOptions,
} from "./session-cookie";

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
    expect(sessionCookieOptions("https://nuvantre.app", expiresAt).secure).toBe(true);
  });

  it("uses the __Host- prefix over https, so no subdomain or path can set or shadow it", () => {
    expect(sessionCookieName("https://nuvantre.app")).toBe("__Host-lp_session");
    expect(sessionCookieName("http://localhost:3000")).toBe("lp_session");
  });

  it("still reads a session cookie set before the prefix, so nobody is signed out by the change", () => {
    expect(sessionCookieNames).toEqual(["__Host-lp_session", "lp_session"]);
  });
});
