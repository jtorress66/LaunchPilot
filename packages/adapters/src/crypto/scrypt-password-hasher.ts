import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type BinaryLike,
  type ScryptOptions,
} from "node:crypto";
import type { PasswordHasher } from "@nuvantre/ports";

const derive = (password: BinaryLike, salt: Buffer, length: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, length, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });

/** OWASP-recommended scrypt parameters (N=2^17, r=8, p=1), stored alongside the hash. */
const defaults = { N: 2 ** 17, r: 8, p: 1, keyLength: 32 };

/** Format: `scrypt$N$r$p$saltBase64$hashBase64`. */
export class ScryptPasswordHasher implements PasswordHasher {
  constructor(private readonly params = defaults) {}

  async hash(password: string): Promise<string> {
    const { N, r, p, keyLength } = this.params;
    const salt = randomBytes(16);
    const key = await derive(password, salt, keyLength, { N, r, p, maxmem: 256 * N * r });
    return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [scheme, n, r, p, salt, hash] = stored.split("$");
    if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
    const expected = Buffer.from(hash, "base64");
    const N = Number(n);
    const key = await derive(password, Buffer.from(salt, "base64"), expected.length, {
      N,
      r: Number(r),
      p: Number(p),
      maxmem: 256 * N * Number(r),
    });
    return key.length === expected.length && timingSafeEqual(key, expected);
  }
}
