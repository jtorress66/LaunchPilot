import type { AgentName, AuditAction, AuditEntry } from "@nuvantre/domain";

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
  content_published: (label) => `published ${quoted(label)}`,
  post_scheduled: (label) => `scheduled ${quoted(label)}`,
  blog_connected: (label) => `connected the blog ${label}`,
  social_connected: (label) => `connected ${label}`,
  analytics_connected: (label) => `connected analytics from ${label}`,
  plan_changed: (label) => `changed your plan to ${label}`,
  autopilot_enabled: (label) => `turned on autopilot for ${label}`,
  autopilot_disabled: (label) => `turned off autopilot for ${label}`,
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

const whoOf = (actor: AuditEntry["actor"]): string => {
  if (actor.kind === "founder") return "You";
  if (actor.kind === "agent") return agentNames[actor.agent];
  return "Nuvantre";
};

const links: Partial<Record<AuditEntry["subject"]["kind"], (id: string) => string>> = {
  product: (id) => `/app/products/${id}/brief`,
  content: (id) => `/app/content/${id}`,
  plan: () => "/app/billing",
};

export const describeActivity = (entry: AuditEntry): ActivityLine => {
  const href = links[entry.subject.kind]?.(entry.subject.id);
  return {
    sentence: `${whoOf(entry.actor)} ${whatHappened[entry.action](entry.subject.label)}`,
    ...(href ? { href } : {}),
  };
};
