import type { TokenHasher } from "@nuvantre/ports";

/** Readable in test output and reversible, so never used outside tests. */
export class FakeTokenHasher implements TokenHasher {
  hash(token: string): string {
    return `hashed:${Buffer.from(token).toString("base64url")}`;
  }
}
