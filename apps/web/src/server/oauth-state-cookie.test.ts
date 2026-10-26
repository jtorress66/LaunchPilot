import { describe, expect, it } from "vitest";
import {
  GOOGLE_STATE_COOKIE,
  googleStateCookieOptions,
  readGoogleState,
} from "./oauth-state-cookie";

describe("Google OAuth state cookie", () => {
  it("is httpOnly, lax, scoped to the callback and short-lived", () => {
    expect(GOOGLE_STATE_COOKIE).toBe("lp_google_oauth");
    expect(googleStateCookieOptions("http://localhost:3000")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/api/google",
      maxAge: 600,
    });
    expect(googleStateCookieOptions("https://nuvantre.app").secure).toBe(true);
  });

  it("carries the state and the product the flow is for", () => {
    const value = JSON.stringify({ state: "st_1", productId: "prod_1" });
    expect(readGoogleState(value)).toEqual({ state: "st_1", productId: "prod_1" });
    expect(readGoogleState(undefined)).toBeNull();
    expect(readGoogleState("not json")).toBeNull();
    expect(readGoogleState(JSON.stringify({ state: 1 }))).toBeNull();
  });
});
