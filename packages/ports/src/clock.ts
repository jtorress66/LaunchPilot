/** Source of the current time. Injected so time-dependent code stays deterministic in tests. */
export interface Clock {
  /** Returns a new Date on every call; successive calls never go backwards. */
  now(): Date;
}
