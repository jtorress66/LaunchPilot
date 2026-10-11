import { randomBytes } from "node:crypto";
import type { TokenGenerator } from "@launchpilot/ports";

/** 256 bits from the OS CSPRNG, base64url-encoded (43 characters). */
export class RandomTokenGenerator implements TokenGenerator {
  generate(): string {
    return randomBytes(32).toString("base64url");
  }
}
