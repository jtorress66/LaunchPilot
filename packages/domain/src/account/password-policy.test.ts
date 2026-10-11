import { describe, expect, it } from "vitest";
import { checkPassword } from "./password-policy";

const email = "founder@acme.dev";

describe("checkPassword", () => {
  it("accepts a 10-character password", () => {
    expect(checkPassword("correcthor", email)).toEqual({ ok: true, value: "correcthor" });
  });

  it.each([
    ["too short", "short", "Use at least 10 characters"],
    ["too long", "x".repeat(201), "Use at most 200 characters"],
    ["only whitespace", " ".repeat(12), "Use at least 10 characters"],
    ["the same as the email", "Founder@Acme.dev", "Don't use your email address as your password"],
  ])("rejects a password that is %s", (_case, password, message) => {
    expect(checkPassword(password, email)).toEqual({
      ok: false,
      error: { code: "weak_password", message },
    });
  });
});
