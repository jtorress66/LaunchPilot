import {
  createBranding,
  createClientWorkspace,
  createInvitation,
  parseEmail,
  productId,
  userId,
  workspaceId,
  type Invitation,
  type Membership,
  type ProductId,
  type ReportBranding,
  type ReportRecipients,
  type Role,
  type UserId,
  type Workspace,
  type WorkspaceId,
} from "@nuvantre/domain";
import { aWorkspace, fixtureNow, unwrap } from "./entities";

export const aMembership = (
  overrides: Partial<{ workspaceId: WorkspaceId; userId: UserId; role: Role }> = {},
): Membership => ({
  workspaceId: overrides.workspaceId ?? workspaceId("ws_1"),
  userId: overrides.userId ?? userId("user_founder"),
  role: overrides.role ?? "owner",
  createdAt: fixtureNow,
});

/** A client workspace of the given agency (by default the fixture workspace "ws_1"). */
export const aClientWorkspace = (
  overrides: Partial<{ id: WorkspaceId; name: string; agency: Workspace }> = {},
): Workspace =>
  unwrap(
    createClientWorkspace(overrides.agency ?? aWorkspace(), {
      id: overrides.id ?? workspaceId("ws_client"),
      name: overrides.name ?? "Acme Corp",
      now: fixtureNow,
    }),
  );

export const anInvitation = (
  overrides: Partial<{
    id: string;
    workspaceId: WorkspaceId;
    email: string;
    role: "member" | "viewer";
    tokenHash: string;
    now: Date;
  }> = {},
): Invitation =>
  unwrap(
    createInvitation({
      id: overrides.id ?? "inv_1",
      workspaceId: overrides.workspaceId ?? workspaceId("ws_1"),
      email: overrides.email ?? "client@acme.test",
      role: overrides.role ?? "viewer",
      tokenHash: overrides.tokenHash ?? "invite-token-hash-1",
      invitedBy: userId("user_founder"),
      now: overrides.now ?? fixtureNow,
    }),
  );

export const aBranding = (
  overrides: Partial<{ workspaceId: WorkspaceId; senderName: string; accentColor: string }> = {},
): ReportBranding =>
  unwrap(
    createBranding({
      workspaceId: overrides.workspaceId ?? workspaceId("ws_1"),
      senderName: overrides.senderName ?? "Brightside Agency",
      accentColor: overrides.accentColor ?? "#0f766e",
      logoUrl: "https://brightside.agency/logo.png",
      replyTo: "hello@brightside.agency",
      footer: "Brightside Agency · Growth for SaaS",
    }),
  );

export const someRecipients = (
  overrides: Partial<{ productId: ProductId; emails: readonly string[]; weekly: boolean }> = {},
): ReportRecipients => ({
  productId: overrides.productId ?? productId("prod_1"),
  emails: (overrides.emails ?? ["client@acme.test"]).map((e) => unwrap(parseEmail(e))),
  weekly: overrides.weekly ?? true,
});
