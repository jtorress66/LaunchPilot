/** Where an unexpected error happened; never a secret, a token or content. */
export interface ErrorContext {
  readonly requestId?: string;
  readonly route?: string;
  readonly workspaceId?: string;
  readonly job?: string;
}

/** Sends unexpected errors somewhere an operator will see them. Never throws. */
export interface ErrorReporter {
  report(error: unknown, context: ErrorContext): void;
}
