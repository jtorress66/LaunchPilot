import { describe, expect, it } from "vitest";
import { parseForm, productForm, signUpForm, upgradeForm } from "./forms";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe("form parsing", () => {
  it("returns typed values for a valid sign-up form", () => {
    expect(
      parseForm(signUpForm, form({ email: "founder@acme.dev", password: "correct horse" })),
    ).toEqual({
      ok: true,
      value: { email: "founder@acme.dev", password: "correct horse" },
    });
  });

  it("returns a friendly message per field", () => {
    expect(parseForm(signUpForm, form({ email: "", password: "" }))).toEqual({
      ok: false,
      error: { email: "Enter your email address", password: "Enter a password" },
    });
  });

  it("caps field lengths so huge inputs never reach the database", () => {
    const result = parseForm(productForm, form({ name: "x".repeat(101), url: "https://acme.dev" }));
    expect(result).toEqual({ ok: false, error: { name: "Use at most 100 characters" } });
  });

  it("accepts only paid plans for an upgrade", () => {
    expect(parseForm(upgradeForm, form({ plan: "growth" }))).toEqual({
      ok: true,
      value: { plan: "growth" },
    });
    expect(parseForm(upgradeForm, form({ plan: "free" })).ok).toBe(false);
  });

  it("treats a missing field like an empty one", () => {
    expect(parseForm(productForm, form({ url: "https://acme.dev" }))).toEqual({
      ok: false,
      error: { name: "Enter a product name" },
    });
  });
});
