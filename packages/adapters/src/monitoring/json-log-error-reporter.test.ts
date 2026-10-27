import { describe, expect, it } from "vitest";
import { JsonLogErrorReporter } from "./json-log-error-reporter";

describe("JsonLogErrorReporter", () => {
  const setUp = () => {
    const lines: string[] = [];
    return { reporter: new JsonLogErrorReporter((line) => lines.push(line)), lines };
  };
  const parsed = (lines: string[]) =>
    lines.map((line) => JSON.parse(line) as Record<string, unknown>);

  it("logs one JSON line with the error, where it happened, and no secrets", () => {
    const { reporter, lines } = setUp();
    const error = new TypeError("connect to postgres://app:s3cret@db/nuvantre failed");
    reporter.report(error, { requestId: "req_1", route: "/app/seo" });
    const [line] = parsed(lines);
    expect(line).toMatchObject({
      event: "error",
      name: "TypeError",
      message: "connect to postgres://app:[redacted]@db/nuvantre failed",
      requestId: "req_1",
      route: "/app/seo",
    });
    expect(String(line?.stack)).not.toContain("s3cret");
    expect(lines[0]).not.toContain("s3cret");
  });

  it("reports something thrown that is not an Error", () => {
    const { reporter, lines } = setUp();
    reporter.report("Bearer abc", { job: "publish-due" });
    expect(parsed(lines)).toEqual([
      { event: "error", name: "NonError", message: "Bearer [redacted]", job: "publish-due" },
    ]);
  });

  it("never throws, even when logging fails", () => {
    const reporter = new JsonLogErrorReporter(() => {
      throw new Error("stdout closed");
    });
    expect(() => {
      reporter.report(new Error("x"), {});
    }).not.toThrow();
  });
});
