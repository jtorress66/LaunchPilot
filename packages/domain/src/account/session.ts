import type { UserId } from "../shared/ids";

export const SESSION_LIFETIME_DAYS = 30;
const lifetimeMs = SESSION_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

export interface Session {
  /** Secret bearer token from the TokenGenerator port. Repositories store only its hash. */
  readonly token: string;
  readonly userId: UserId;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export const startSession = (input: { token: string; userId: UserId; now: Date }): Session => ({
  token: input.token,
  userId: input.userId,
  createdAt: input.now,
  expiresAt: new Date(input.now.getTime() + lifetimeMs),
});

export const isActive = (session: Session, now: Date): boolean =>
  now.getTime() < session.expiresAt.getTime();
