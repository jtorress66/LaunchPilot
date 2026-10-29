import type { AgentName, AuditAction, AuditEntry, UserId } from "@nuvantre/domain";

/** One line of the Activity page, and where the item lives in the app (if anywhere). */
export interface ActivityLine {
  readonly sentence: string;
  readonly href?: string;
}

const quoted = (label: string) => `“${label}”`;

/** What each action did to its subject, as the rest of a sentence. */
const whatHappened: Record<AuditAction, (label: string) => string> = {
  signed_in: () => "signed in",
  product_created: (label) => `added ${label}`,
  product_archived: (label) => `archived ${label}`,
  product_restored: (label) => `restored ${label}`,
  product_activated: (label) => `made ${label} active`,
  brief_approved: (label) => `approved the Product Brief for ${label}`,
  content_approved: (label) => `approved ${quoted(label)}`,
  content_rejected: (label) => `rejected ${quoted(label)}`,
  content_published: (label) => `published ${quoted(label)}`,
  post_scheduled: (label) => `scheduled ${quoted(label)}`,
  blog_connected: (label) => `connected the blog ${label}`,
  social_connected: (label) => `connected ${label}`,
  analytics_connected: (label) => `connected analytics from ${label}`,
  plan_changed: (label) => `changed your plan to ${label}`,
  autopilot_enabled: (label) => `turned on autopilot for ${label}`,
  autopilot_disabled: (label) => `turned off autopilot for ${label}`,
  client_added: (label) => `added the client ${label}`,
  member_invited: (label) => `invited ${label}`,
  member_joined: (label) => `joined as ${label}`,
  member_removed: (label) => `removed ${label}`,
  branding_updated: (label) => `updated the report branding (${label})`,
  report_sent: (label) => `emailed the report ${label}`,
};

const agentNames: Record<AgentName, string> = {
  brief: "Your brief agent",
  strategist: "Your strategist",
  seo: "Your SEO agent",
  launch: "Your launch agent",
  social: "Your social agent",
  analyst: "Your analyst",
  reviewer: "Your reviewer",
};

/** Who is reading, and the people of the workspace by id, so "You" is only ever the reader. */
export interface ActivityContext {
  readonly viewerId?: UserId;
  readonly people?: Readonly<Record<string, string>>;
}

const whoOf = (actor: AuditEntry["actor"], context: ActivityContext): string => {
  if (actor.kind === "founder") {
    if (context.viewerId === undefined || actor.userId === context.viewerId) return "You";
    return context.people?.[actor.userId] ?? "A teammate";
  }
  if (actor.kind === "agent") return agentNames[actor.agent];
  return "Nuvantre";
};

const links: Partial<Record<AuditEntry["subject"]["kind"], (id: string) => string>> = {
  product: (id) => `/app/products/${id}/brief`,
  content: (id) => `/app/content/${id}`,
  plan: () => "/app/billing",
};

export const describeActivity = (
  entry: AuditEntry,
  context: ActivityContext = {},
): ActivityLine => {
  const href = links[entry.subject.kind]?.(entry.subject.id);
  return {
    sentence: `${whoOf(entry.actor, context)} ${whatHappened[entry.action](entry.subject.label)}`,
    ...(href ? { href } : {}),
  };
};
