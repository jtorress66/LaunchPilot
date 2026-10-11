/** Expected failure from an external system, returned as a Result instead of thrown. */
export interface PortError<Code extends string> {
  readonly code: Code;
  readonly message: string;
  /** True when the same call may succeed later (rate limit, timeout, outage). */
  readonly retryable: boolean;
}
