import type { Email, Result } from "@nuvantre/domain";
import type { PortError } from "./port-error";

export interface EmailMessage {
  readonly to: readonly Email[];
  /** Shown as the sender's name; the address is the app's verified sending address. */
  readonly fromName: string;
  readonly replyTo?: Email | undefined;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  /** The same key never sends twice, so a retried request cannot email a client twice. */
  readonly idempotencyKey: string;
}

export type MailerErrorCode = "mailer_unauthorized" | "mailer_rejected" | "mailer_unavailable";

/** Sends one email. Knows nothing about reports or invitations. */
export interface Mailer {
  send(message: EmailMessage): Promise<Result<{ readonly id: string }, PortError<MailerErrorCode>>>;
}
