import { describe, expect, it } from "vitest";
import { parseEmail, type Email } from "../account/email";
import { userId, workspaceId } from "../shared/ids";
import { acceptInvitation, createInvitation, INVITATION_LIFETIME_DAYS } from "./invitation";

const now = new Date("2026-10-01T00:00:00Z");
const email = (value: string) => {
  const parsed = parseEmail(value);
  if (!parsed.ok) throw new Error(value);
  return parsed.value;
};
const invite = (role = "viewer") =>
  createInvitation({
    id: "inv_1",
    workspaceId: workspaceId("ws_1"),
    email: " Client@Acme.test ",
    role,
    tokenHash: "hash",
    invitedBy: userId("usr_owner"),
    now,
  });

describe("invitations", () => {
  it("invites a member or a viewer by email, for seven days", () => {
    const created = invite();
    expect(created).toMatchObject({
      ok: true,
      value: { email: "client@acme.test", role: "viewer", acceptedAt: null },
    });
    if (!created.ok) return;
    expect(created.value.expiresAt.getTime() - now.getTime()).toBe(
      INVITATION_LIFETIME_DAYS * 86_400_000,
    );
    expect(invite("member").ok).toBe(true);
  });

  it("never invites an owner, an unknown role or a bad address", () => {
    expect(invite("owner")).toMatchObject({ ok: false, error: { code: "invalid_role" } });
    expect(invite("admin")).toMatchObject({ ok: false, error: { code: "invalid_role" } });
    expect(
      createInvitation({
        id: "inv_2",
        workspaceId: workspaceId("ws_1"),
        email: "nope",
        role: "member",
        tokenHash: "h",
        invitedBy: userId("usr_owner"),
        now,
      }).ok,
    ).toBe(false);
  });

  it("is accepted once, by the invited address, before it expires", () => {
    const created = invite();
    if (!created.ok) throw new Error("setup");
    const later = new Date(now.getTime() + 60_000);
    const accepted = acceptInvitation(created.value, {
      email: email("client@acme.test"),
      now: later,
    });
    expect(accepted).toMatchObject({ ok: true, value: { acceptedAt: later } });
    if (!accepted.ok) return;
    expect(
      acceptInvitation(accepted.value, { email: email("client@acme.test"), now: later }),
    ).toMatchObject({
      ok: false,
      error: { code: "invitation_used" },
    });
  });

  it("refuses another address and an expired invitation", () => {
    const created = invite();
    if (!created.ok) throw new Error("setup");
    expect(
      acceptInvitation(created.value, { email: email("someone@else.test"), now }),
    ).toMatchObject({ ok: false, error: { code: "invitation_email_mismatch" } });
    expect(
      acceptInvitation(created.value, {
        email: "client@acme.test" as Email,
        now: created.value.expiresAt,
      }),
    ).toMatchObject({ ok: false, error: { code: "invitation_expired" } });
  });
});
