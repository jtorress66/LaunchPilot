export type DomainErrorCode =
  | "invalid_text"
  | "invalid_url"
  | "invalid_transition"
  | "approval_requires_founder"
  | "channel_is_draft_only"
  | "publish_time_in_past"
  | "brief_has_no_facts"
  | "not_publishable"
  | "invalid_email"
  | "weak_password"
  | "plan_limit_reached"
  | "plan_not_purchasable"
  | "launch_kit_not_approved"
  | "community_draft_not_approved";

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
}

export const domainError = (code: DomainErrorCode, message: string): DomainError => ({
  code,
  message,
});
