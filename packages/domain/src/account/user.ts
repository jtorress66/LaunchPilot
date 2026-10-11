import type { UserId } from "../shared/ids";
import type { Email } from "./email";

export interface User {
  readonly id: UserId;
  readonly email: Email;
  /** Produced by the PasswordHasher port; opaque to the domain. */
  readonly passwordHash: string;
  readonly createdAt: Date;
}

export const createUser = (input: {
  id: UserId;
  email: Email;
  passwordHash: string;
  now: Date;
}): User => ({
  id: input.id,
  email: input.email,
  passwordHash: input.passwordHash,
  createdAt: input.now,
});
