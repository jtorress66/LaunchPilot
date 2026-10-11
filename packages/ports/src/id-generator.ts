/** Source of new unique ids. Injected so tests get predictable ids. */
export interface IdGenerator {
  next(): string;
}
