import { err, ok, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";
import type { Brand } from "../shared/ids";

export type Email = Brand<string, "Email">;

const shape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalised (trimmed, lowercase) address, so lookups are case-insensitive. */
export const parseEmail = (value: string): Result<Email, DomainError> => {
  const normalised = value.trim().toLowerCase();
  return normalised.length <= 254 && shape.test(normalised)
    ? ok(normalised as Email)
    : err(domainError("invalid_email", "Enter a valid email address"));
};
