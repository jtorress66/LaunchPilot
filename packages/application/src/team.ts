import {
  acceptInvitation,
  createInvitation,
  err,
  ok,
  type Email,
  type Invitation,
  type Result,
  type Role,
  type User,
  type UserId,
  type Workspace,
} from "@nuvantre/domain";
import type {
  BrandingRepository,
  IdGenerator,
  InvitationRepository,
  Mailer,
  MailerErrorCode,
  PortError,
  SessionRepository,
  TokenGenerator,
  TokenHasher,
  UserRepository,
} from "@nuvantre/ports";
import { useWorkspace } from "@nuvantre/domain";
import { founderOfAccess, recordAudit, type AuditDeps } from "./audit";
import { brandingFor } from "./branding";
import { failure, type UseCaseError } from "./errors";
import { escapeHtml } from "./html";
import { authorize, type AccessDeps, type WorkspaceAccess } from "./workspace-access";

type InviteDeps = AccessDeps &
  AuditDeps & {
    readonly invitations: InvitationRepository;
    readonly branding: BrandingRepository;
    readonly mailer: Mailer;
    readonly tokens: TokenGenerator;
    readonly tokenHasher: TokenHasher;
    readonly ids: IdGenerator;
    readonly appUrl: string;
  };

const roleNames: Readonly<Record<Role, string>> = {
  owner: "an owner",
  member: "a team member",
  viewer: "a client viewer",
};

/** Emails a seven-day invitation link; only the hash of the link's token is stored. */
export class InviteMember {
  constructor(private readonly deps: InviteDeps) {}

  async execute(input: {
    access: WorkspaceAccess;
    email: string;
    role: string;
  }): Promise<Result<Invitation, UseCaseError | PortError<MailerErrorCode>>> {
    const allowed = authorize(input.access, "manage_team");
    if (!allowed.ok) return allowed;
    const { workspace, user } = input.access;
    const token = this.deps.tokens.generate();
    const invitation = createInvitation({
      id: this.deps.ids.next(),
      workspaceId: workspace.id,
      email: input.email,
      role: input.role,
      tokenHash: this.deps.tokenHasher.hash(token),
      invitedBy: user.id,
      now: this.deps.clock.now(),
    });
    if (!invitation.ok) return invitation;
    const link = `${this.deps.appUrl}/invite/${token}`;
    const branding = await brandingFor(this.deps, workspace);
    const from = branding?.senderName ?? "Nuvantre";
    const role = roleNames[invitation.value.role];
    const sent = await this.deps.mailer.send({
      to: [invitation.value.email],
      fromName: from,
      replyTo: branding?.replyTo ?? user.email,
      subject: `You're invited to ${workspace.name}`,
      text: `${from} invited you to ${workspace.name} as ${role}.\n\nAccept within 7 days: ${link}\n`,
      html: `<p>${escapeHtml(from)} invited you to <strong>${escapeHtml(workspace.name)}</strong> as ${role}.</p><p><a href="${escapeHtml(link)}">Accept the invitation</a> within 7 days.</p>`,
      idempotencyKey: `invite:${invitation.value.id}`,
    });
    if (!sent.ok) return sent;
    await this.deps.invitations.save(invitation.value);
    await recordAudit(this.deps, {
      workspaceId: workspace.id,
      actor: founderOfAccess(input.access),
      action: "member_invited",
      subject: { kind: "member", id: invitation.value.id, label: invitation.value.email },
    });
    return invitation;
  }
}

const notFound = () =>
  err(failure("invitation_not_found", "This invitation link is not valid. Ask for a new one."));

export interface InvitationDetails {
  readonly workspaceName: string;
  readonly email: Email;
  readonly role: Invitation["role"];
  readonly expired: boolean;
  readonly accepted: boolean;
}

/** What an invitation link is for, so its page can explain it before anyone signs in. */
export class GetInvitation {
  constructor(
    private readonly deps: AccessDeps & {
      readonly invitations: InvitationRepository;
      readonly tokenHasher: TokenHasher;
      readonly clock: AuditDeps["clock"];
    },
  ) {}

  async execute(token: string): Promise<Result<InvitationDetails, UseCaseError>> {
    const invitation = await this.deps.invitations.findByTokenHash(
      this.deps.tokenHasher.hash(token),
    );
    const workspace = invitation && (await this.deps.workspaces.findById(invitation.workspaceId));
    if (!invitation || !workspace) return notFound();
    return ok({
      workspaceName: workspace.name,
      email: invitation.email,
      role: invitation.role,
      expired: this.deps.clock.now().getTime() >= invitation.expiresAt.getTime(),
      accepted: invitation.acceptedAt !== null,
    });
  }
}

/** Joins the invited workspace with the invited role and opens it. */
export class AcceptInvitation {
  constructor(
    private readonly deps: AccessDeps &
      AuditDeps & {
        readonly invitations: InvitationRepository;
        readonly sessions: SessionRepository;
        readonly tokenHasher: TokenHasher;
      },
  ) {}

  async execute(input: {
    token: string;
    user: User;
    sessionToken: string;
  }): Promise<Result<Workspace, UseCaseError>> {
    const invitation = await this.deps.invitations.findByTokenHash(
      this.deps.tokenHasher.hash(input.token),
    );
    const workspace = invitation && (await this.deps.workspaces.findById(invitation.workspaceId));
    if (!invitation || !workspace) return notFound();
    const now = this.deps.clock.now();
    const accepted = acceptInvitation(invitation, { email: input.user.email, now });
    if (!accepted.ok) return accepted;
    // An existing (possibly higher) role is kept; the invitation only ever adds access.
    if (!(await this.deps.memberships.find(workspace.id, input.user.id))) {
      await this.deps.memberships.save({
        workspaceId: workspace.id,
        userId: input.user.id,
        role: invitation.role,
        createdAt: now,
      });
    }
    await this.deps.invitations.save(accepted.value);
    const session = await this.deps.sessions.findByToken(input.sessionToken);
    if (session) await this.deps.sessions.save(useWorkspace(session, workspace.id));
    await recordAudit(this.deps, {
      workspaceId: workspace.id,
      actor: { kind: "founder", userId: input.user.id },
      action: "member_joined",
      subject: { kind: "member", id: input.user.id, label: input.user.email },
    });
    return ok(workspace);
  }
}

export interface TeamMember {
  readonly userId: UserId;
  readonly email: Email;
  readonly role: Role;
}

export interface Team {
  readonly members: readonly TeamMember[];
  readonly pending: readonly Invitation[];
}

/** The workspace's members, oldest first, and invitations not yet accepted. */
export class ListTeam {
  constructor(
    private readonly deps: AccessDeps & {
      readonly users: UserRepository;
      readonly invitations: InvitationRepository;
    },
  ) {}

  async execute(input: { access: WorkspaceAccess }): Promise<Result<Team, UseCaseError>> {
    const allowed = authorize(input.access, "view");
    if (!allowed.ok) return allowed;
    const { workspace } = input.access;
    const memberships = [...(await this.deps.memberships.listByWorkspace(workspace.id))].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const members = await Promise.all(
      memberships.map(async (m) => ({
        userId: m.userId,
        email: (await this.deps.users.findById(m.userId))?.email ?? ("unknown" as Email),
        role: m.role,
      })),
    );
    return ok({ members, pending: await this.deps.invitations.listPending(workspace.id) });
  }
}

export class RemoveMember {
  constructor(private readonly deps: AccessDeps & AuditDeps & { readonly users: UserRepository }) {}

  async execute(input: {
    access: WorkspaceAccess;
    userId: UserId;
  }): Promise<Result<null, UseCaseError>> {
    const allowed = authorize(input.access, "manage_team");
    if (!allowed.ok) return allowed;
    const { workspace } = input.access;
    const membership = await this.deps.memberships.find(workspace.id, input.userId);
    if (!membership) return err(failure("member_not_found", "This person is not a member"));
    if (membership.role === "owner") {
      const owners = (await this.deps.memberships.listByWorkspace(workspace.id)).filter(
        (m) => m.role === "owner",
      );
      if (owners.length <= 1) {
        return err(failure("last_owner", "A workspace always keeps at least one owner"));
      }
    }
    await this.deps.memberships.delete(workspace.id, input.userId);
    const removed = await this.deps.users.findById(input.userId);
    await recordAudit(this.deps, {
      workspaceId: workspace.id,
      actor: founderOfAccess(input.access),
      action: "member_removed",
      subject: { kind: "member", id: input.userId, label: removed?.email ?? "member" },
    });
    return ok(null);
  }
}
