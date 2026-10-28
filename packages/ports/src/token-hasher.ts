/** One-way hash of a secret link token, so stored rows never hold the token itself. */
export interface TokenHasher {
  hash(token: string): string;
}
