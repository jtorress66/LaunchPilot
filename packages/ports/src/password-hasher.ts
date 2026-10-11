/** One-way, salted password hashing. Implementations must compare in constant time. */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}
