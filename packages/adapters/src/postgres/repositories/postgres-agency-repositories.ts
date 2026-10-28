import type {
  Invitation,
  Membership,
  ProductId,
  ReportBranding,
  ReportRecipients,
  UserId,
  WorkspaceId,
} from "@nuvantre/domain";
import type {
  BrandingRepository,
  InvitationRepository,
  MembershipRepository,
  ReportRecipientRepository,
} from "@nuvantre/ports";
import type { Kysely } from "kysely";
import {
  brandingMapper,
  invitationMapper,
  membershipMapper,
  reportRecipientsMapper,
} from "../mappers/agency-mappers";
import type { Database } from "../schema";

export class PostgresMembershipRepository implements MembershipRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async find(workspaceId: WorkspaceId, userId: UserId): Promise<Membership | undefined> {
    const row = await this.db
      .selectFrom("memberships")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return row && membershipMapper.fromRow(row);
  }

  async listByUser(userId: UserId): Promise<readonly Membership[]> {
    const rows = await this.db
      .selectFrom("memberships")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at")
      .execute();
    return rows.map(membershipMapper.fromRow);
  }

  async listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Membership[]> {
    const rows = await this.db
      .selectFrom("memberships")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .orderBy("created_at")
      .execute();
    return rows.map(membershipMapper.fromRow);
  }

  async save(membership: Membership): Promise<void> {
    const row = membershipMapper.toRow(membership);
    await this.db
      .insertInto("memberships")
      .values(row)
      .onConflict((c) => c.columns(["workspace_id", "user_id"]).doUpdateSet({ role: row.role }))
      .execute();
  }

  async delete(workspaceId: WorkspaceId, userId: UserId): Promise<void> {
    await this.db
      .deleteFrom("memberships")
      .where("workspace_id", "=", workspaceId)
      .where("user_id", "=", userId)
      .execute();
  }
}

export class PostgresInvitationRepository implements InvitationRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByTokenHash(tokenHash: string): Promise<Invitation | undefined> {
    const row = await this.db
      .selectFrom("invitations")
      .selectAll()
      .where("token_hash", "=", tokenHash)
      .executeTakeFirst();
    return row && invitationMapper.fromRow(row);
  }

  async listPending(workspaceId: WorkspaceId): Promise<readonly Invitation[]> {
    const rows = await this.db
      .selectFrom("invitations")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("accepted_at", "is", null)
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .execute();
    return rows.map(invitationMapper.fromRow);
  }

  async save(invitation: Invitation): Promise<void> {
    const row = invitationMapper.toRow(invitation);
    await this.db
      .insertInto("invitations")
      .values(row)
      .onConflict((c) => c.column("id").doUpdateSet(row))
      .execute();
  }
}

export class PostgresBrandingRepository implements BrandingRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByWorkspace(workspaceId: WorkspaceId): Promise<ReportBranding | undefined> {
    const row = await this.db
      .selectFrom("report_branding")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .executeTakeFirst();
    return row && brandingMapper.fromRow(row);
  }

  async save(branding: ReportBranding): Promise<void> {
    const row = brandingMapper.toRow(branding);
    await this.db
      .insertInto("report_branding")
      .values(row)
      .onConflict((c) => c.column("workspace_id").doUpdateSet(row))
      .execute();
  }
}

export class PostgresReportRecipientRepository implements ReportRecipientRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByProduct(productId: ProductId): Promise<ReportRecipients | undefined> {
    const row = await this.db
      .selectFrom("report_recipients")
      .selectAll()
      .where("product_id", "=", productId)
      .executeTakeFirst();
    return row && reportRecipientsMapper.fromRow(row);
  }

  async save(recipients: ReportRecipients): Promise<void> {
    const row = reportRecipientsMapper.toRow(recipients);
    await this.db
      .insertInto("report_recipients")
      .values(row)
      .onConflict((c) => c.column("product_id").doUpdateSet(row))
      .execute();
  }
}
