/** Unguessable, URL-safe secrets such as session tokens. */
export interface TokenGenerator {
  generate(): string;
}
