import { describe, expect, it } from "vitest";
import { parseDatabaseConfig } from "./config";

describe("parseDatabaseConfig", () => {
  it.each([
    "postgres://app:secret@localhost:5432/launchpilot",
    "postgresql://db.internal/launchpilot",
  ])("accepts %s", (url) => {
    expect(parseDatabaseConfig({ DATABASE_URL: url })).toEqual({
      ok: true,
      value: { connectionString: url },
    });
  });

  it("explains that DATABASE_URL is required when it is missing", () => {
    expect(parseDatabaseConfig({})).toEqual({
      ok: false,
      error: "DATABASE_URL is required",
    });
  });

  it.each(["mysql://localhost/db", "not a url", ""])("rejects %j as not a Postgres URL", (url) => {
    expect(parseDatabaseConfig({ DATABASE_URL: url })).toEqual({
      ok: false,
      error: "DATABASE_URL must be a postgres:// or postgresql:// URL",
    });
  });
});
