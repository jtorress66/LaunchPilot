import { describe, expect, it } from "vitest";
import { appNav } from "./app-nav";

const labels = (input: Parameters<typeof appNav>[0]) => appNav(input).map((i) => i.label);

describe("appNav", () => {
  it("gives an agency owner the clients, team and branding pages", () => {
    expect(labels({ role: "owner", isClient: false, inboxCount: 2 })).toEqual([
      "Dashboard",
      "Inbox (2)",
      "Activity",
      "Clients",
      "Team",
      "Branding",
      "Billing",
    ]);
  });

  it("gives a member the work but not the business pages", () => {
    expect(labels({ role: "member", isClient: false, inboxCount: 0 })).toEqual([
      "Dashboard",
      "Inbox",
      "Activity",
    ]);
  });

  it("keeps clients, branding and billing on the agency, not inside a client", () => {
    expect(labels({ role: "owner", isClient: true, inboxCount: 0 })).toEqual([
      "Dashboard",
      "Inbox",
      "Activity",
      "Team",
    ]);
  });

  it("shows a client viewer only their reports and the activity", () => {
    expect(labels({ role: "viewer", isClient: true, inboxCount: 5 })).toEqual([
      "Dashboard",
      "Activity",
    ]);
  });
});
