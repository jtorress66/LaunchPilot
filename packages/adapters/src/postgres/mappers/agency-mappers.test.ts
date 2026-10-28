import { aBranding, aMembership, anInvitation, someRecipients } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import {
  brandingMapper,
  invitationMapper,
  membershipMapper,
  reportRecipientsMapper,
} from "./agency-mappers";

describe("agency mappers", () => {
  it("round-trips a membership", () => {
    const membership = aMembership({ role: "viewer" });
    const row = membershipMapper.toRow(membership);
    expect(row).toEqual({
      workspace_id: "ws_1",
      user_id: "user_founder",
      role: "viewer",
      created_at: membership.createdAt,
    });
    expect(membershipMapper.fromRow(row)).toEqual(membership);
  });

  it("round-trips an invitation, storing only the token's hash", () => {
    const invitation = anInvitation();
    const row = invitationMapper.toRow(invitation);
    expect(row).toMatchObject({
      token_hash: "invite-token-hash-1",
      email: "client@acme.test",
      role: "viewer",
      accepted_at: null,
    });
    expect(invitationMapper.fromRow(row)).toEqual(invitation);
  });

  it("round-trips branding and a product's report recipients", () => {
    const branding = aBranding();
    expect(brandingMapper.fromRow(brandingMapper.toRow(branding))).toEqual(branding);
    const recipients = someRecipients({ emails: ["a@acme.test", "b@acme.test"] });
    const row = reportRecipientsMapper.toRow(recipients);
    expect(row).toMatchObject({ product_id: "prod_1", emails: '["a@acme.test","b@acme.test"]' });
    expect(reportRecipientsMapper.fromRow(row)).toEqual(recipients);
  });

  it.each([
    [
      "an unknown role",
      () => membershipMapper.fromRow({ ...membershipMapper.toRow(aMembership()), role: "admin" }),
      /memberships\.role/,
    ],
    [
      "an owner invitation",
      () => invitationMapper.fromRow({ ...invitationMapper.toRow(anInvitation()), role: "owner" }),
      /invitations\.role/,
    ],
    [
      "recipients that are not addresses",
      () =>
        reportRecipientsMapper.fromRow({
          ...reportRecipientsMapper.toRow(someRecipients()),
          emails: '["nope"]',
        }),
      /report_recipients\.emails/,
    ],
  ])("refuses %s", (_case, read, message) => {
    expect(read).toThrow(message);
  });
});
