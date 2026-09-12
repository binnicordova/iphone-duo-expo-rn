/**
 * The tiniest possible observable. The fold's tilt changes at sensor rate, so
 * it deliberately lives outside React state: subscribers opt in, and the
 * wrapped app tree never re-renders because the device moved.
 */
export class Store<T> {
  private listeners = new Set<(value: T) => void>();

  constructor(private value: T) {}

  get(): T {
    return this.value;
  }

  set(next: T): void {
    if (Object.is(next, this.value)) return;
    this.value = next;
    for (const listener of this.listeners) listener(next);
  }

  /** Shallow-merges a patch and notifies only when something actually changed. */
  patch(partial: Partial<T>): void {
    const next = { ...this.value, ...partial } as T;
    const keys = Object.keys(partial) as (keyof T)[];
    if (keys.every((key) => Object.is(this.value[key], partial[key]))) return;
    this.value = next;
    for (const listener of this.listeners) listener(next);
  }

  subscribe(listener: (value: T) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
