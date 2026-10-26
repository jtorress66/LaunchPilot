import type { PasswordHasher } from "@nuvantre/ports";

const toHex = (text: string) =>
  Array.from(new TextEncoder().encode(text), (byte) => byte.toString(16).padStart(2, "0")).join("");

/** Fast, reversible stand-in for scrypt. NOT secure: for tests only. Counts calls for timing tests. */
export class FakePasswordHasher implements PasswordHasher {
  hashCalls = 0;
  verifyCalls = 0;
  private salt = 0;

  hash(password: string): Promise<string> {
    this.hashCalls += 1;
    this.salt += 1;
    return Promise.resolve(`fakehash$${this.salt}$${toHex(password)}`);
  }

  verify(password: string, hash: string): Promise<boolean> {
    this.verifyCalls += 1;
    const [scheme, , hex] = hash.split("$");
    return Promise.resolve(scheme === "fakehash" && hex === toHex(password));
  }
}
