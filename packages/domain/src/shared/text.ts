import { err, ok, type Result } from "../result";
import { domainError, type DomainError } from "./errors";

export interface TextRule {
  readonly field: string;
  readonly max: number;
}

/** Trimmed, non-empty text no longer than `max` characters. */
export const nonEmptyText = (
  value: string,
  { field, max }: TextRule,
): Result<string, DomainError> => {
  const trimmed = value.trim();
  if (trimmed === "") return err(domainError("invalid_text", `${field} must not be empty`));
  if (trimmed.length > max) {
    return err(domainError("invalid_text", `${field} must be at most ${max} characters`));
  }
  return ok(trimmed);
};
