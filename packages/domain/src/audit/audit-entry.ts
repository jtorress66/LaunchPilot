import type { Actor } from "../shared/actor";
import type { WorkspaceId } from "../shared/ids";

/** What the Activity page records. Data, so a new audited action is one more entry. */
export const auditActions = [
  "signed_in",
  "product_created",
  "product_archived",
  "product_restored",
  "product_activated",
  "brief_approved",
  "content_approved",
  "content_rejected",
  "content_published",
  "post_scheduled",
  "blog_connected",
  "social_connected",
  "analytics_connected",
  "plan_changed",
  "autopilot_enabled",
  "autopilot_disabled",
  "client_added",
  "member_invited",
  "member_joined",
  "member_removed",
  "branding_updated",
  "report_sent",
] as const;
export type AuditAction = (typeof auditActions)[number];

export type AuditActor = Actor | { readonly kind: "system" };

export interface AuditSubject {
  readonly kind:
    | "account"
    | "product"
    | "brief"
    | "content"
    | "connection"
    | "plan"
    | "workspace"
    | "member"
    | "branding"
    | "report";
  readonly id: string;
  /** A short name for the item (its title or site), never its content or a secret. */
  readonly label: string;
}

export interface AuditEntry {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly actor: AuditActor;
  readonly action: AuditAction;
  readonly subject: AuditSubject;
  readonly at: Date;
}

const MAX_LABEL = 120;

const shortLabel = (label: string, kind: string): string => {
  const line = label.replace(/\s+/g, " ").trim();
  if (line === "") return kind;
  return line.length <= MAX_LABEL ? line : `${line.slice(0, MAX_LABEL - 1)}…`;
};

export const createAuditEntry = (input: {
  id: string;
  workspaceId: WorkspaceId;
  actor: AuditActor;
  action: AuditAction;
  subject: AuditSubject;
  now: Date;
}): AuditEntry => ({
  id: input.id,
  workspaceId: input.workspaceId,
  actor: input.actor,
  action: input.action,
  subject: { ...input.subject, label: shortLabel(input.subject.label, input.subject.kind) },
  at: input.now,
});
