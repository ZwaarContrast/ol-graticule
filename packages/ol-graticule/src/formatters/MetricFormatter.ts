import type { LabelFormatter } from '../types.js';
import { BoundedCache } from '../util/boundedCache.js';
import { formatDecimal } from '../util/formatNumber.js';

export interface MetricFormatterOptions {
  /** Display unit; `'m'` rolls over to `'km'` at ≥1000. */
  unit?: 'm' | 'ft' | 'us-ft' | undefined;
}

/** Linear-unit label formatter (handles metres and foot-based CRSs). */
export class MetricFormatter implements LabelFormatter {
  private readonly unit_: 'm' | 'ft' | 'us-ft';
  private readonly cache_ = new BoundedCache<number, string>();

  constructor(options?: MetricFormatterOptions) {
    this.unit_ = options?.unit ?? 'm';
  }

  format(value: number): string {
    const cached = this.cache_.get(value);
    if (cached !== undefined) return cached;

    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    let result: string;

    if (this.unit_ === 'm') {
      result = abs >= 1000
        ? `${sign}${formatDecimal(abs / 1000, 1)} km`
        : `${sign}${formatDecimal(abs, 1)} m`;
    } else {
      result = `${sign}${formatDecimal(abs, 1)} ${this.unit_}`;
    }

    this.cache_.set(value, result);
    return result;
  }
}
