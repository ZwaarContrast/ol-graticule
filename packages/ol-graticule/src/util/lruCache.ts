/** Map-backed LRU cache evicting the least-recently-used entry on overflow. */
export class LruCache<K, V> {
  private readonly map_ = new Map<K, V>();
  private readonly max_: number;

  constructor(max: number) {
    if (max <= 0) throw new Error(`LruCache max must be > 0, got ${max}`);
    this.max_ = max;
  }

  /** Look up a key; on hit, touch it to the MRU end. */
  get(key: K): V | undefined {
    const v = this.map_.get(key);
    if (v === undefined && !this.map_.has(key)) return undefined;
    this.map_.delete(key);
    this.map_.set(key, v as V);
    return v;
  }

  /** Insert or refresh `key`, dropping the LRU entry on overflow. */
  set(key: K, value: V): void {
    if (this.map_.has(key)) {
      this.map_.delete(key);
    } else if (this.map_.size >= this.max_) {
      const oldest = this.map_.keys().next().value;
      if (oldest !== undefined) this.map_.delete(oldest);
    }
    this.map_.set(key, value);
  }

  /** Inspect a key without MRU promotion. */
  peek(key: K): V | undefined {
    return this.map_.get(key);
  }

  get size(): number {
    return this.map_.size;
  }

  clear(): void {
    this.map_.clear();
  }
}
