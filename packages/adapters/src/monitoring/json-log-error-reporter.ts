import type { ErrorContext, ErrorReporter } from "@nuvantre/ports";
import { scrubSecrets } from "./scrub-secrets";

const STACK_LINES = 8;

/** The default reporter: one scrubbed JSON line per error, for the host's log tooling. */
export class JsonLogErrorReporter implements ErrorReporter {
  constructor(private readonly log: (line: string) => void) {}

  report(error: unknown, context: ErrorContext): void {
    try {
      const details =
        error instanceof Error
          ? {
              name: error.name,
              message: scrubSecrets(error.message),
              ...(error.stack
                ? { stack: scrubSecrets(error.stack.split("\n").slice(0, STACK_LINES).join("\n")) }
                : {}),
            }
          : { name: "NonError", message: scrubSecrets(String(error)) };
      this.log(JSON.stringify({ event: "error", ...details, ...context }));
    } catch {
      // Reporting must never take the request or job down with it.
    }
  }
}
