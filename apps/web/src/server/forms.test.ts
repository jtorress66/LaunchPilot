import { describe, expect, it } from "vitest";
import { briefForm, parseForm, productForm, signUpForm, upgradeForm } from "./forms";

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

  it("reads a brief, one list item per line, dropping blank lines", () => {
    const result = parseForm(
      briefForm,
      form({
        audience: " Solo founders ",
        problem: "No time for marketing",
        solution: "An AI marketing team",
        tone: "Direct",
        differentiators: "Approval first\r\n\n  Weekly loop  \n",
        facts: "Free 14-day trial\n",
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        audience: " Solo founders ",
        problem: "No time for marketing",
        solution: "An AI marketing team",
        tone: "Direct",
        differentiators: ["Approval first", "Weekly loop"],
        facts: ["Free 14-day trial"],
      },
    });
  });

  it("accepts a brief with no facts so the founder can save work in progress", () => {
    const result = parseForm(
      briefForm,
      form({ audience: "a", problem: "b", solution: "c", tone: "d" }),
    );
    expect(result.ok && result.value.facts).toEqual([]);
  });

  it("caps brief fields, list items and list length", () => {
    const base = { audience: "a", problem: "b", solution: "c", tone: "d" };
    expect(parseForm(briefForm, form({ ...base, audience: "x".repeat(2001) }))).toEqual({
      ok: false,
      error: { audience: "Use at most 2000 characters" },
    });
    expect(parseForm(briefForm, form({ ...base, facts: "x".repeat(501) }))).toEqual({
      ok: false,
      error: { facts: "Keep each line under 500 characters" },
    });
    const many = Array.from({ length: 21 }, (_, i) => `Fact ${i}`).join("\n");
    expect(parseForm(briefForm, form({ ...base, facts: many }))).toEqual({
      ok: false,
      error: { facts: "Use at most 20 lines" },
    });
  });
});
