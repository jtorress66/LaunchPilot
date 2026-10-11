import { describe, expect, it } from "vitest";
import { all, andThen, err, isErr, isOk, map, ok, unwrapOr, type Result } from "./result";

const half = (n: number): Result<number, string> => (n % 2 === 0 ? ok(n / 2) : err("odd"));

describe("Result", () => {
  it("wraps a success value in an ok result", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it("wraps a failure in an err result", () => {
    expect(err("boom")).toEqual({ ok: false, error: "boom" });
  });

  it("narrows with isOk and isErr", () => {
    const success: Result<number, string> = ok(1);
    const failure: Result<number, string> = err("no");
    expect(isOk(success)).toBe(true);
    expect(isErr(success)).toBe(false);
    expect(isOk(failure)).toBe(false);
    expect(isErr(failure)).toBe(true);
  });

  it("transforms only ok values with map", () => {
    expect(map(ok(2), (n: number) => n * 10)).toEqual(ok(20));
    expect(map(err<string>("bad"), (n: number) => n * 10)).toEqual(err("bad"));
  });

  it("chains with andThen and short-circuits on the first error", () => {
    expect(andThen(ok(8), half)).toEqual(ok(4));
    expect(andThen(ok(3), half)).toEqual(err("odd"));
    expect(andThen(err<string>("earlier"), half)).toEqual(err("earlier"));
  });

  it("returns the fallback from unwrapOr only when the result is an error", () => {
    expect(unwrapOr(ok(5), 0)).toBe(5);
    expect(unwrapOr(err("x"), 0)).toBe(0);
  });

  it("collects every ok value with all, in order", () => {
    expect(all([ok(1), ok(2), ok(3)])).toEqual(ok([1, 2, 3]));
    expect(all([])).toEqual(ok([]));
  });

  it("returns the first error from all", () => {
    expect(all([ok(1), err("first"), err("second")])).toEqual(err("first"));
  });
});
