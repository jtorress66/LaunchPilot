import type { TokenHasher } from "@nuvantre/ports";
import { sha256Hex } from "./sha256";

/** SHA-256 of a link token, as sessions are stored. The token is long and random, so no salt. */
export class Sha256TokenHasher implements TokenHasher {
  hash(token: string): string {
    return sha256Hex(token);
  }
}
