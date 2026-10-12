import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AesGcmTokenCipher } from "./aes-gcm-token-cipher";

const key = () => randomBytes(32).toString("base64");

describe("AesGcmTokenCipher", () => {
  it("produces a versioned ciphertext that differs every time", async () => {
    const cipher = new AesGcmTokenCipher(key());
    const a = await cipher.encrypt("secret");
    const b = await cipher.encrypt("secret");
    expect(a).toMatch(/^v1:[\w-]+:[\w-]+:[\w-]+$/);
    expect(a).not.toBe(b);
  });

  it("refuses a ciphertext that was tampered with", async () => {
    const cipher = new AesGcmTokenCipher(key());
    const [version, iv, tag, data = ""] = (await cipher.encrypt("secret")).split(":");
    const flipped = `${data.startsWith("A") ? "B" : "A"}${data.slice(1)}`;
    await expect(cipher.decrypt([version, iv, tag, flipped].join(":"))).rejects.toThrow();
  });

  it("refuses a ciphertext made with another key", async () => {
    const ciphertext = await new AesGcmTokenCipher(key()).encrypt("secret");
    await expect(new AesGcmTokenCipher(key()).decrypt(ciphertext)).rejects.toThrow();
  });

  it("refuses an unknown format", async () => {
    await expect(new AesGcmTokenCipher(key()).decrypt("v0:x")).rejects.toThrow(
      "Unsupported ciphertext format",
    );
  });

  it("needs a 32-byte key", () => {
    expect(() => new AesGcmTokenCipher(randomBytes(16).toString("base64"))).toThrow(
      "TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded",
    );
  });
});
