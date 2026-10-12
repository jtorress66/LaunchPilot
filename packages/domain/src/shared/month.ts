/** Midnight UTC on the first day of `now`'s month: the start of a plan's monthly allowance. */
export const startOfUtcMonth = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
