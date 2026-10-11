import { describe, expect, it } from "vitest";
import { InMemoryStore } from "./in-memory-store";

describe("InMemoryStore", () => {
  it("filters stored values and returns copies", () => {
    const store = new InMemoryStore<string, { id: string; tag: string }>();
    store.put({ id: "a", tag: "x" });
    store.put({ id: "b", tag: "y" });
    const [first] = store.filter((v) => v.tag === "x");
    expect(first).toEqual({ id: "a", tag: "x" });
    if (first) first.tag = "changed";
    expect(store.get("a")).toEqual({ id: "a", tag: "x" });
  });
});
