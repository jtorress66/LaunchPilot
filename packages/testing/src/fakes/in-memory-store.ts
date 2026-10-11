/** Map-backed storage that copies on the way in and out, like a real database would. */
export class InMemoryStore<Id, T extends { readonly id: Id }> {
  private readonly items = new Map<Id, T>();

  get(id: Id): T | undefined {
    const item = this.items.get(id);
    return item === undefined ? undefined : structuredClone(item);
  }

  put(item: T): void {
    this.items.set(item.id, structuredClone(item));
  }

  filter(predicate: (item: T) => boolean): T[] {
    return [...this.items.values()].filter(predicate).map((item) => structuredClone(item));
  }
}
