import { describe, expect, it } from "vitest";
import { nonEmptyText } from "./text";

describe("nonEmptyText", () => {
  it("trims surrounding whitespace", () => {
    expect(nonEmptyText("  Acme  ", { field: "name", max: 10 })).toEqual({
      ok: true,
      value: "Acme",
    });
  });

  it.each(["", "   ", "\n\t"])("rejects empty or whitespace-only input %j", (value) => {
    const result = nonEmptyText(value, { field: "name", max: 10 });
    expect(result).toEqual({
      ok: false,
      error: { code: "invalid_text", message: "name must not be empty" },
    });
  });

  it("rejects input longer than the limit and names the field", () => {
    const result = nonEmptyText("abcdef", { field: "title", max: 5 });
    expect(result).toEqual({
      ok: false,
      error: { code: "invalid_text", message: "title must be at most 5 characters" },
    });
  });

  it("accepts input exactly at the limit", () => {
    expect(nonEmptyText("abcde", { field: "title", max: 5 }).ok).toBe(true);
  });
});
