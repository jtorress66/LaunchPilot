import { parseEmail, type Email } from "../account/email";
import { err, ok, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";
import type { ProductId } from "../shared/ids";

export const MAX_REPORT_RECIPIENTS = 10;

/** Who receives a product's weekly report by email, and whether it goes out automatically. */
export interface ReportRecipients {
  readonly productId: ProductId;
  readonly emails: readonly Email[];
  readonly weekly: boolean;
}

/** One to ten distinct addresses, from text separated by commas, spaces or new lines. */
export const parseRecipients = (text: string): Result<readonly Email[], DomainError> => {
  const parts = text.split(/[\s,;]+/).filter((part) => part !== "");
  if (parts.length === 0) return err(domainError("invalid_email", "Enter at least one address"));
  const emails: Email[] = [];
  for (const part of parts) {
    const email = parseEmail(part);
    if (!email.ok) {
      return err(domainError("invalid_email", `“${part}” is not a valid email address`));
    }
    if (!emails.includes(email.value)) emails.push(email.value);
  }
  if (emails.length > MAX_REPORT_RECIPIENTS) {
    return err(domainError("invalid_email", `Send to at most ${MAX_REPORT_RECIPIENTS} addresses`));
  }
  return ok(emails);
};
