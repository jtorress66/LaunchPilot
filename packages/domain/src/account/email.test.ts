import { describe, expect, it } from "vitest";
import { parseEmail } from "./email";

describe("parseEmail", () => {
  it("trims and lowercases an address", () => {
    expect(parseEmail("  Founder@Acme.DEV ")).toEqual({ ok: true, value: "founder@acme.dev" });
  });

  it.each(["founder", "founder@", "@acme.dev", "founder@acme", "a b@acme.dev", ""])(
    "rejects %j",
    (value) => {
      expect(parseEmail(value)).toEqual({
        ok: false,
        error: { code: "invalid_email", message: "Enter a valid email address" },
      });
    },
  );

  it("rejects an address longer than 254 characters", () => {
    expect(parseEmail(`${"a".repeat(250)}@acme.dev`).ok).toBe(false);
  });
});
