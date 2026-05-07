/** Bounded map that bulk-clears on overflow. */
export class BoundedCache<K, V> {
  private readonly map_ = new Map<K, V>();
  private readonly max_: number;

  constructor(max = 512) {
    this.max_ = max;
  }

  get(key: K): V | undefined {
    return this.map_.get(key);
  }

  set(key: K, value: V): void {
    if (this.map_.size >= this.max_) this.map_.clear();
    this.map_.set(key, value);
  }
}
