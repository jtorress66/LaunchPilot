import { describe, expect, it } from "vitest";
import { fit } from "./fit";

describe("fit", () => {
  it("keeps short text as it is, trimmed", () => {
    expect(fit("  Lesson planning  ", 20)).toBe("Lesson planning");
  });

  it("cuts long text at a word boundary and marks the cut", () => {
    expect(fit("Lesson planning for mixed classes", 22)).toBe("Lesson planning for…");
  });

  it("cuts inside a word when there is no space to cut at", () => {
    expect(fit("Gradebooks".repeat(3), 8)).toBe("Gradebo…");
  });
});
