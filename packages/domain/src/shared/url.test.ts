import { describe, expect, it } from "vitest";
import { parseHttpUrl } from "./url";

describe("parseHttpUrl", () => {
  it.each([
    ["https://acme.dev", "https://acme.dev/"],
    ["  http://acme.dev/pricing  ", "http://acme.dev/pricing"],
    ["https://ACME.dev/Path?q=1", "https://acme.dev/Path?q=1"],
  ])("accepts %j and normalises it to %j", (input, expected) => {
    expect(parseHttpUrl(input)).toEqual({ ok: true, value: expected });
  });

  it.each(["javascript:alert(1)", "ftp://acme.dev", "/relative/path", "acme.dev", "", "https://"])(
    "rejects %j",
    (input) => {
      const result = parseHttpUrl(input);
      expect(result.ok).toBe(false);
      expect(result.ok ? undefined : result.error.code).toBe("invalid_url");
    },
  );
});
