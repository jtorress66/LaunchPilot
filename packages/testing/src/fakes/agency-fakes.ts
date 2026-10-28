import type {
  Invitation,
  Membership,
  ProductId,
  ReportBranding,
  ReportRecipients,
  Result,
  UserId,
  WorkspaceId,
} from "@nuvantre/domain";
import type {
  BrandingRepository,
  EmailMessage,
  InvitationRepository,
  Mailer,
  MailerErrorCode,
  MembershipRepository,
  PortError,
  ReportRecipientRepository,
} from "@nuvantre/ports";
import { InMemoryStore } from "./in-memory-store";
import { NextFailure } from "./next-failure";

export class InMemoryMembershipRepository implements MembershipRepository {
  private readonly store = new InMemoryStore<string, Membership>(
    (m) => `${m.workspaceId}|${m.userId}`,
  );

  find(workspaceId: WorkspaceId, userId: UserId): Promise<Membership | undefined> {
    return Promise.resolve(this.store.get(`${workspaceId}|${userId}`));
  }

  listByUser(userId: UserId): Promise<readonly Membership[]> {
    return Promise.resolve(this.store.filter((m) => m.userId === userId));
  }

  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Membership[]> {
    return Promise.resolve(this.store.filter((m) => m.workspaceId === workspaceId));
  }

  save(membership: Membership): Promise<void> {
    this.store.put(membership);
    return Promise.resolve();
  }

  delete(workspaceId: WorkspaceId, userId: UserId): Promise<void> {
    this.store.delete(`${workspaceId}|${userId}`);
    return Promise.resolve();
  }
}

export class InMemoryInvitationRepository implements InvitationRepository {
  private readonly store = new InMemoryStore<string, Invitation>((i) => i.id);

  findByTokenHash(tokenHash: string): Promise<Invitation | undefined> {
    return Promise.resolve(this.store.filter((i) => i.tokenHash === tokenHash)[0]);
  }

  listPending(workspaceId: WorkspaceId): Promise<readonly Invitation[]> {
    return Promise.resolve(
      this.store
        .filter((i) => i.workspaceId === workspaceId && i.acceptedAt === null)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    );
  }

  save(invitation: Invitation): Promise<void> {
    this.store.put(invitation);
    return Promise.resolve();
  }
}

export class InMemoryBrandingRepository implements BrandingRepository {
  private readonly store = new InMemoryStore<WorkspaceId, ReportBranding>((b) => b.workspaceId);

  findByWorkspace(workspaceId: WorkspaceId): Promise<ReportBranding | undefined> {
    return Promise.resolve(this.store.get(workspaceId));
  }

  save(branding: ReportBranding): Promise<void> {
    this.store.put(branding);
    return Promise.resolve();
  }
}

export class InMemoryReportRecipientRepository implements ReportRecipientRepository {
  private readonly store = new InMemoryStore<ProductId, ReportRecipients>((r) => r.productId);

  findByProduct(productId: ProductId): Promise<ReportRecipients | undefined> {
    return Promise.resolve(this.store.get(productId));
  }

  save(recipients: ReportRecipients): Promise<void> {
    this.store.put(recipients);
    return Promise.resolve();
  }
}

type SendResult = Result<{ readonly id: string }, PortError<MailerErrorCode>>;

/** Keeps every message it is asked to send, so tests can read what a client would receive. */
export class RecordingMailer implements Mailer {
  readonly sent: EmailMessage[] = [];
  private readonly byKey = new Map<string, SendResult>();
  private readonly failure = new NextFailure<PortError<MailerErrorCode>>();

  failNext(error: PortError<MailerErrorCode>): void {
    this.failure.set(error);
  }

  send(message: EmailMessage): Promise<SendResult> {
    const earlier = this.byKey.get(message.idempotencyKey);
    if (earlier) return Promise.resolve(earlier);
    const error = this.failure.take();
    if (error) return Promise.resolve({ ok: false, error });
    this.sent.push(message);
    const result: SendResult = { ok: true, value: { id: `email_${this.sent.length}` } };
    this.byKey.set(message.idempotencyKey, result);
    return Promise.resolve(result);
  }
}
