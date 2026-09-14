// Cache in-memory terbatas (bounded) untuk data yang mahal dihitung/diambil.
// Cocok pada Node server (`next start`) karena satu proses hidup terus.

type CacheEntry<T> = { value: T; expiresAt: number };

export interface BoundedCacheOptions {
  ttlMs: number;
  maxEntries: number;
  pruneIntervalMs?: number;
}

export class BoundedCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private lastPrune = 0;
  private readonly pruneIntervalMs: number;

  constructor({ ttlMs, maxEntries, pruneIntervalMs = 60_000 }: BoundedCacheOptions) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.pruneIntervalMs = pruneIntervalMs;
  }

  get(key: string): T | undefined {
    this.pruneExpired();
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    this.pruneExpired();
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  get size(): number {
    return this.store.size;
  }

  private pruneExpired(): void {
    const now = Date.now();
    if (now - this.lastPrune < this.pruneIntervalMs) return;
    this.lastPrune = now;
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }
}