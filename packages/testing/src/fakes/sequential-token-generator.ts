import type { TokenGenerator } from "@launchpilot/ports";

/** Predictable 32-character tokens: `token_0000…0001`, `token_0000…0002`, … */
export class SequentialTokenGenerator implements TokenGenerator {
  private count = 0;

  generate(): string {
    this.count += 1;
    return `token_${String(this.count).padStart(26, "0")}`;
  }
}
