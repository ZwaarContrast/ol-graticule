import type { LabelFormatter } from '../types.js';
import { BoundedCache } from '../util/boundedCache.js';

export class PixelFormatter implements LabelFormatter {
  private readonly cache_ = new BoundedCache<number, string>();

  format(value: number): string {
    const key = Math.round(value);
    const cached = this.cache_.get(key);
    if (cached !== undefined) return cached;
    const result = `${key} px`;
    this.cache_.set(key, result);
    return result;
  }
}
