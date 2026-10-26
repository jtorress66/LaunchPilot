import type { TokenCipher } from "@nuvantre/ports";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

const encode = (buffer: Buffer) => buffer.toString("base64url");
const decode = (text: string) => Buffer.from(text, "base64url");

/**
 * Encrypts secrets at rest with AES-256-GCM: a random 96-bit IV per secret and an
 * authentication tag, so tampering is detected. The version prefix allows key rotation.
 */
export class AesGcmTokenCipher implements TokenCipher {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, "base64");
    if (this.key.length !== 32) {
      throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
    }
  }

  encrypt(plaintext: string): Promise<string> {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return Promise.resolve(
      [VERSION, encode(iv), encode(cipher.getAuthTag()), encode(data)].join(":"),
    );
  }

  decrypt(ciphertext: string): Promise<string> {
    const [version, iv, tag, data] = ciphertext.split(":");
    if (version !== VERSION || iv === undefined || tag === undefined || data === undefined) {
      return Promise.reject(new Error("Unsupported ciphertext format"));
    }
    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, decode(iv));
      decipher.setAuthTag(decode(tag));
      return Promise.resolve(
        Buffer.concat([decipher.update(decode(data)), decipher.final()]).toString("utf8"),
      );
    } catch {
      return Promise.reject(new Error("The secret could not be decrypted"));
    }
  }
}
