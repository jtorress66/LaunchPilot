import type {
  Invitation,
  Membership,
  ProductId,
  ReportBranding,
  ReportRecipients,
  UserId,
  WorkspaceId,
} from "@nuvantre/domain";

export interface MembershipRepository {
  find(workspaceId: WorkspaceId, userId: UserId): Promise<Membership | undefined>;
  listByUser(userId: UserId): Promise<readonly Membership[]>;
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Membership[]>;
  /** Inserts or replaces the membership of that user in that workspace. */
  save(membership: Membership): Promise<void>;
  delete(workspaceId: WorkspaceId, userId: UserId): Promise<void>;
}

export interface InvitationRepository {
  findByTokenHash(tokenHash: string): Promise<Invitation | undefined>;
  /** Invitations not yet accepted, newest first; expired ones included so they can be resent. */
  listPending(workspaceId: WorkspaceId): Promise<readonly Invitation[]>;
  save(invitation: Invitation): Promise<void>;
}

export interface BrandingRepository {
  findByWorkspace(workspaceId: WorkspaceId): Promise<ReportBranding | undefined>;
  save(branding: ReportBranding): Promise<void>;
}

export interface ReportRecipientRepository {
  findByProduct(productId: ProductId): Promise<ReportRecipients | undefined>;
  save(recipients: ReportRecipients): Promise<void>;
}
