/** Lets a test make exactly the next call of a fake fail. Shared by every fake via composition. */
export class NextFailure<E> {
  private queued: E | undefined;

  set(error: E): void {
    this.queued = error;
  }

  take(): E | undefined {
    const error = this.queued;
    this.queued = undefined;
    return error;
  }
}
