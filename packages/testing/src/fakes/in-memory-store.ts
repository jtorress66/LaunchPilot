/** Map-backed storage that copies on the way in and out, like a real database would. */
export class InMemoryStore<K, T> {
  private readonly items = new Map<K, T>();

  constructor(private readonly keyOf: (item: T) => K) {}

  get(key: K): T | undefined {
    const item = this.items.get(key);
    return item === undefined ? undefined : structuredClone(item);
  }

  put(item: T): void {
    this.items.set(this.keyOf(item), structuredClone(item));
  }

  delete(key: K): void {
    this.items.delete(key);
  }

  filter(predicate: (item: T) => boolean): T[] {
    return [...this.items.values()].filter(predicate).map((item) => structuredClone(item));
  }
}
