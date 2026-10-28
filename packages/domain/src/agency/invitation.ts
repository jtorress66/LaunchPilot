import { parseEmail, type Email } from "../account/email";
import { err, ok, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";
import type { UserId, WorkspaceId } from "../shared/ids";
import type { Role } from "./roles";

export const INVITATION_LIFETIME_DAYS = 7;

export type InvitedRole = Exclude<Role, "owner">;

export interface Invitation {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly email: Email;
  readonly role: InvitedRole;
  /** Hash of the secret link token; the token itself is only ever in the email. */
  readonly tokenHash: string;
  readonly invitedBy: UserId;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
}

const invitedRoles: readonly string[] = ["member", "viewer"];

export const createInvitation = (input: {
  id: string;
  workspaceId: WorkspaceId;
  email: string;
  role: string;
  tokenHash: string;
  invitedBy: UserId;
  now: Date;
}): Result<Invitation, DomainError> => {
  if (!invitedRoles.includes(input.role)) {
    return err(domainError("invalid_role", "Invite someone as a member or a client viewer"));
  }
  const email = parseEmail(input.email);
  if (!email.ok) return email;
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    email: email.value,
    role: input.role as InvitedRole,
    tokenHash: input.tokenHash,
    invitedBy: input.invitedBy,
    createdAt: input.now,
    expiresAt: new Date(input.now.getTime() + INVITATION_LIFETIME_DAYS * 86_400_000),
    acceptedAt: null,
  });
};

export const acceptInvitation = (
  invitation: Invitation,
  by: { email: Email; now: Date },
): Result<Invitation, DomainError> => {
  if (invitation.acceptedAt !== null) {
    return err(domainError("invitation_used", "This invitation has already been accepted"));
  }
  if (by.now.getTime() >= invitation.expiresAt.getTime()) {
    return err(
      domainError("invitation_expired", "This invitation has expired. Ask for a new one."),
    );
  }
  if (by.email !== invitation.email) {
    return err(
      domainError(
        "invitation_email_mismatch",
        `This invitation is for ${invitation.email}. Log in with that address to accept it.`,
      ),
    );
  }
  return ok({ ...invitation, acceptedAt: by.now });
};
