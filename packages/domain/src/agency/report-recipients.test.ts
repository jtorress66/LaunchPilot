import { describe, expect, it } from "vitest";
import { MAX_REPORT_RECIPIENTS, parseRecipients } from "./report-recipients";

describe("report recipients", () => {
  it("takes addresses separated by commas, spaces or new lines, lowercased and without repeats", () => {
    expect(parseRecipients("Client@Acme.test, boss@acme.test\nclient@acme.test ")).toEqual({
      ok: true,
      value: ["client@acme.test", "boss@acme.test"],
    });
  });

  it("needs at least one address and at most ten", () => {
    expect(parseRecipients(" , ")).toMatchObject({ ok: false, error: { code: "invalid_email" } });
    const eleven = Array.from({ length: MAX_REPORT_RECIPIENTS + 1 }, (_, i) => `p${i}@acme.test`);
    expect(parseRecipients(eleven.join(","))).toMatchObject({
      ok: false,
      error: { code: "invalid_email", message: "Send to at most 10 addresses" },
    });
  });

  it("names the address it cannot read", () => {
    expect(parseRecipients("client@acme.test, nope")).toMatchObject({
      ok: false,
      error: { message: "“nope” is not a valid email address" },
    });
  });
});
