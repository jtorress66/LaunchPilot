import type { DomainError } from "@launchpilot/domain";

export type ApplicationErrorCode =
  | "email_taken"
  | "invalid_credentials"
  | "unauthenticated"
  | "session_expired"
  | "workspace_not_found"
  | "subscription_not_found"
  | "billing_failed"
  | "invalid_signature"
  | "product_not_found"
  | "brief_not_found"
  | "crawl_failed"
  | "brief_not_approved"
  | "no_keyword_opportunities"
  | "task_not_found"
  | "content_not_found"
  | "social_not_connected"
  | "launch_kit_not_found"
  | "directory_not_found"
  | "submission_not_found";

/** What a use case can report: a broken domain rule or an application-level refusal. */
export type UseCaseError =
  DomainError | { readonly code: ApplicationErrorCode; readonly message: string };

export const failure = (code: ApplicationErrorCode, message: string) =>
  ({ code, message }) as const;
