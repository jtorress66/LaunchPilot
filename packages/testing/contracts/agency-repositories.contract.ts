import { acceptInvitation, parseEmail, productId, userId, workspaceId } from "@nuvantre/domain";
import type {
  BrandingRepository,
  InvitationRepository,
  MembershipRepository,
  ReportRecipientRepository,
} from "@nuvantre/ports";
import { describe, expect, it } from "vitest";
import { aBranding, aMembership, anInvitation, someRecipients } from "../src/fixtures/agency";
import { fixtureNow, unwrap } from "../src/fixtures/entities";

type Make<R> = () => R | Promise<R>;

const sortBy = <T>(items: readonly T[], key: (item: T) => string) =>
  [...items].sort((a, b) => key(a).localeCompare(key(b)));

export function describeMembershipRepositoryContract(
  name: string,
  make: Make<MembershipRepository>,
): void {
  describe(`MembershipRepository contract: ${name}`, () => {
    it("finds a membership by workspace and user", async () => {
      const repo = await make();
      const owner = aMembership({ workspaceId: workspaceId("ws_1"), userId: userId("user_1") });
      await repo.save(owner);
      expect(await repo.find(workspaceId("ws_1"), userId("user_1"))).toEqual(owner);
      expect(await repo.find(workspaceId("ws_1"), userId("user_2"))).toBeUndefined();
      expect(await repo.find(workspaceId("ws_2"), userId("user_1"))).toBeUndefined();
    });

    it("lists a user's memberships and a workspace's members", async () => {
      const repo = await make();
      const a = aMembership({ workspaceId: workspaceId("ws_1"), userId: userId("user_1") });
      const b = aMembership({
        workspaceId: workspaceId("ws_2"),
        userId: userId("user_1"),
        role: "viewer",
      });
      const c = aMembership({
        workspaceId: workspaceId("ws_1"),
        userId: userId("user_2"),
        role: "member",
      });
      for (const m of [a, b, c]) await repo.save(m);
      expect(sortBy(await repo.listByUser(userId("user_1")), (m) => m.workspaceId)).toEqual([a, b]);
      expect(sortBy(await repo.listByWorkspace(workspaceId("ws_1")), (m) => m.userId)).toEqual([
        a,
        c,
      ]);
      expect(await repo.listByUser(userId("user_9"))).toEqual([]);
    });

    it("replaces a member's role when saved again, and forgets them once deleted", async () => {
      const repo = await make();
      await repo.save(aMembership({ userId: userId("user_2"), role: "viewer" }));
      const promoted = aMembership({ userId: userId("user_2"), role: "member" });
      await repo.save(promoted);
      expect(await repo.listByWorkspace(workspaceId("ws_1"))).toEqual([promoted]);
      await repo.delete(workspaceId("ws_1"), userId("user_2"));
      expect(await repo.find(workspaceId("ws_1"), userId("user_2"))).toBeUndefined();
      await expect(repo.delete(workspaceId("ws_1"), userId("user_9"))).resolves.toBeUndefined();
    });
  });
}

export function describeInvitationRepositoryContract(
  name: string,
  make: Make<InvitationRepository>,
): void {
  describe(`InvitationRepository contract: ${name}`, () => {
    it("finds an invitation by the hash of its token", async () => {
      const repo = await make();
      const invitation = anInvitation({ tokenHash: "hash-a" });
      await repo.save(invitation);
      expect(await repo.findByTokenHash("hash-a")).toEqual(invitation);
      expect(await repo.findByTokenHash("hash-b")).toBeUndefined();
    });

    it("lists only the workspace's invitations not yet accepted, newest first", async () => {
      const repo = await make();
      const older = anInvitation({ id: "inv_1", tokenHash: "h1", email: "a@acme.test" });
      const newer = anInvitation({
        id: "inv_2",
        tokenHash: "h2",
        email: "b@acme.test",
        now: new Date(fixtureNow.getTime() + 60_000),
      });
      const accepted = unwrap(
        acceptInvitation(anInvitation({ id: "inv_3", tokenHash: "h3", email: "c@acme.test" }), {
          email: unwrap(parseEmail("c@acme.test")),
          now: fixtureNow,
        }),
      );
      const elsewhere = anInvitation({
        id: "inv_4",
        tokenHash: "h4",
        workspaceId: workspaceId("ws_2"),
      });
      for (const i of [older, newer, accepted, elsewhere]) await repo.save(i);
      expect(await repo.listPending(workspaceId("ws_1"))).toEqual([newer, older]);
    });

    it("keeps the acceptance when an invitation is saved again", async () => {
      const repo = await make();
      const invitation = anInvitation();
      await repo.save(invitation);
      const accepted = unwrap(
        acceptInvitation(invitation, { email: invitation.email, now: fixtureNow }),
      );
      await repo.save(accepted);
      expect(await repo.findByTokenHash(invitation.tokenHash)).toEqual(accepted);
    });
  });
}

export function describeBrandingRepositoryContract(
  name: string,
  make: Make<BrandingRepository>,
): void {
  describe(`BrandingRepository contract: ${name}`, () => {
    it("keeps one branding per workspace, replaced when saved again", async () => {
      const repo = await make();
      expect(await repo.findByWorkspace(workspaceId("ws_1"))).toBeUndefined();
      await repo.save(aBranding());
      const renamed = aBranding({ senderName: "Brightside Studio", accentColor: "#123abc" });
      await repo.save(renamed);
      expect(await repo.findByWorkspace(workspaceId("ws_1"))).toEqual(renamed);
      expect(await repo.findByWorkspace(workspaceId("ws_2"))).toBeUndefined();
    });
  });
}

export function describeReportRecipientRepositoryContract(
  name: string,
  make: Make<ReportRecipientRepository>,
): void {
  describe(`ReportRecipientRepository contract: ${name}`, () => {
    it("keeps one recipient list per product, in order, replaced when saved again", async () => {
      const repo = await make();
      expect(await repo.findByProduct(productId("prod_1"))).toBeUndefined();
      await repo.save(someRecipients());
      const updated = someRecipients({
        emails: ["boss@acme.test", "client@acme.test"],
        weekly: false,
      });
      await repo.save(updated);
      expect(await repo.findByProduct(productId("prod_1"))).toEqual(updated);
      expect(await repo.findByProduct(productId("prod_2"))).toBeUndefined();
    });
  });
}
