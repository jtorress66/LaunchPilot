import { describe, expect, it } from "vitest";
import { workspaceId } from "../shared/ids";
import { createBranding } from "./branding";

const valid = {
  workspaceId: workspaceId("ws_agency"),
  senderName: "  Brightside Agency ",
  accentColor: "#0F766E",
  logoUrl: "https://brightside.agency/logo.png",
  replyTo: "Hello@Brightside.agency",
  footer: "Brightside Agency · 1 Main St",
};

describe("report branding", () => {
  it("keeps a trimmed sender name, a lowercase colour and a normalised reply-to", () => {
    expect(createBranding(valid)).toEqual({
      ok: true,
      value: {
        workspaceId: "ws_agency",
        senderName: "Brightside Agency",
        accentColor: "#0f766e",
        logoUrl: "https://brightside.agency/logo.png",
        replyTo: "hello@brightside.agency",
        footer: "Brightside Agency · 1 Main St",
      },
    });
  });

  it("treats a blank logo and footer as none", () => {
    expect(createBranding({ ...valid, logoUrl: " ", footer: "" })).toMatchObject({
      ok: true,
      value: { logoUrl: null, footer: null },
    });
  });

  it.each([
    ["an empty sender name", { senderName: " " }],
    ["a sender name over 60 characters", { senderName: "x".repeat(61) }],
    ["a colour that is not #rrggbb", { accentColor: "teal" }],
    ["a logo that is not https", { logoUrl: "http://brightside.agency/logo.png" }],
    ["a bad reply-to address", { replyTo: "hello" }],
    ["a footer over 200 characters", { footer: "x".repeat(201) }],
  ])("refuses %s", (_case, change) => {
    expect(createBranding({ ...valid, ...change }).ok).toBe(false);
  });
});
