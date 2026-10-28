import {
  parseEmail,
  productId,
  roles,
  userId,
  workspaceId,
  type Email,
  type Invitation,
  type Membership,
  type ReportBranding,
  type ReportRecipients,
} from "@nuvantre/domain";
import type { BrandingRow, InvitationRow, MembershipRow, ReportRecipientsRow } from "../schema";
import { oneOf, readJson, toJson } from "./columns";

const email = (value: string, column: string): Email => {
  const parsed = parseEmail(value);
  if (!parsed.ok) throw new Error(`Unexpected value "${value}" in ${column}`);
  return parsed.value;
};

export const membershipMapper = {
  toRow: (m: Membership): MembershipRow => ({
    workspace_id: m.workspaceId,
    user_id: m.userId,
    role: m.role,
    created_at: m.createdAt,
  }),
  fromRow: (row: MembershipRow): Membership => ({
    workspaceId: workspaceId(row.workspace_id),
    userId: userId(row.user_id),
    role: oneOf(roles, row.role, "memberships.role"),
    createdAt: row.created_at,
  }),
};

export const invitationMapper = {
  toRow: (i: Invitation): InvitationRow => ({
    id: i.id,
    workspace_id: i.workspaceId,
    email: i.email,
    role: i.role,
    token_hash: i.tokenHash,
    invited_by: i.invitedBy,
    created_at: i.createdAt,
    expires_at: i.expiresAt,
    accepted_at: i.acceptedAt,
  }),
  fromRow: (row: InvitationRow): Invitation => ({
    id: row.id,
    workspaceId: workspaceId(row.workspace_id),
    email: email(row.email, "invitations.email"),
    role: oneOf(["member", "viewer"] as const, row.role, "invitations.role"),
    tokenHash: row.token_hash,
    invitedBy: userId(row.invited_by),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
  }),
};

export const brandingMapper = {
  toRow: (b: ReportBranding): BrandingRow => ({
    workspace_id: b.workspaceId,
    sender_name: b.senderName,
    accent_color: b.accentColor,
    logo_url: b.logoUrl,
    reply_to: b.replyTo,
    footer: b.footer,
  }),
  fromRow: (row: BrandingRow): ReportBranding => ({
    workspaceId: workspaceId(row.workspace_id),
    senderName: row.sender_name,
    accentColor: row.accent_color,
    logoUrl: row.logo_url,
    replyTo: email(row.reply_to, "report_branding.reply_to"),
    footer: row.footer,
  }),
};

export const reportRecipientsMapper = {
  toRow: (r: ReportRecipients): ReportRecipientsRow => ({
    product_id: r.productId,
    emails: toJson(r.emails),
    weekly: r.weekly,
  }),
  fromRow: (row: ReportRecipientsRow): ReportRecipients => {
    const emails = readJson(row.emails);
    if (!Array.isArray(emails)) throw new Error("Unexpected value in report_recipients.emails");
    return {
      productId: productId(row.product_id),
      emails: emails.map((e: unknown) => email(String(e), "report_recipients.emails")),
      weekly: row.weekly,
    };
  },
};
