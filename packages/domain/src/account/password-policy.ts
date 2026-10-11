import { err, ok, type Result } from "../result";
import { domainError, type DomainError } from "../shared/errors";

const weak = (message: string) => err(domainError("weak_password", message));

/** Length-based policy (NIST 800-63B style): no composition rules, but no trivial choices. */
export const checkPassword = (password: string, email: string): Result<string, DomainError> => {
  if (password.trim().length < 10) return weak("Use at least 10 characters");
  if (password.length > 200) return weak("Use at most 200 characters");
  if (password.trim().toLowerCase() === email.trim().toLowerCase()) {
    return weak("Don't use your email address as your password");
  }
  return ok(password);
};
