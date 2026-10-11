import { describe, expect, it } from "vitest";
import { fieldFor } from "./messages";

describe("fieldFor", () => {
  it.each([
    ["invalid_email", "email"],
    ["email_taken", "email"],
    ["weak_password", "password"],
    ["invalid_url", "url"],
    ["invalid_text", "name"],
    ["plan_limit_reached", "form"],
    ["invalid_credentials", "form"],
  ] as const)("shows a %s error on the %s field", (code, field) => {
    expect(fieldFor(code)).toBe(field);
  });
});
