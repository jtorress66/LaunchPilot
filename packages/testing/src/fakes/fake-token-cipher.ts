import type { TokenCipher } from "@launchpilot/ports";

const toHex = (text: string) =>
  Array.from(new TextEncoder().encode(text), (byte) => byte.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string) =>
  new TextDecoder().decode(
    Uint8Array.from({ length: hex.length / 2 }, (_, i) =>
      parseInt(hex.slice(i * 2, i * 2 + 2), 16),
    ),
  );

/** Reversible hex encoding. NOT encryption: for tests only. */
export class FakeTokenCipher implements TokenCipher {
  encrypt(plaintext: string): Promise<string> {
    return Promise.resolve(`fake:${toHex(plaintext)}`);
  }

  decrypt(ciphertext: string): Promise<string> {
    return Promise.resolve(fromHex(ciphertext.replace(/^fake:/, "")));
  }
}
