import type { LabelFormatter } from '../types.js';
import { BoundedCache } from '../util/boundedCache.js';
import { formatDecimal } from '../util/formatNumber.js';

export type DegreeFormat = 'dms' | 'dd' | 'ddm';

export class DegreeFormatter implements LabelFormatter {
  private readonly degreeFormat_: DegreeFormat;
  private readonly xCache_ = new BoundedCache<number, string>();
  private readonly yCache_ = new BoundedCache<number, string>();

  constructor(format: DegreeFormat = 'dms') {
    this.degreeFormat_ = format;
  }

  format(value: number, axis: 'x' | 'y'): string {
    const cache = axis === 'x' ? this.xCache_ : this.yCache_;
    const cached = cache.get(value);
    if (cached !== undefined) return cached;

    let result: string;
    switch (this.degreeFormat_) {
      case 'dms':
        result = this.formatDMS(value, axis);
        break;
      case 'dd':
        result = this.formatDD(value, axis);
        break;
      case 'ddm':
        result = this.formatDDM(value, axis);
        break;
    }
    cache.set(value, result);
    return result;
  }

  private formatDMS(value: number, axis: 'x' | 'y'): string {
    const hemisphere = this.getHemisphere(value, axis);
    const abs = Math.abs(value);
    let d = Math.floor(abs);
    const minutesFloat = (abs - d) * 60;
    let m = Math.floor(minutesFloat);
    let s = Math.round((minutesFloat - m) * 60);

    if (s === 60) {
      s = 0;
      m += 1;
    }
    if (m === 60) {
      m = 0;
      d += 1;
    }

    return `${d}°${m.toString().padStart(2, '0')}′${s.toString().padStart(2, '0')}″${hemisphere}`;
  }

  private formatDD(value: number, axis: 'x' | 'y'): string {
    const hemisphere = this.getHemisphere(value, axis);
    return `${formatDecimal(Math.abs(value), 4)}°${hemisphere}`;
  }

  private formatDDM(value: number, axis: 'x' | 'y'): string {
    const hemisphere = this.getHemisphere(value, axis);
    const abs = Math.abs(value);
    const degrees = Math.floor(abs);
    const minutes = (abs - degrees) * 60;
    return `${degrees}°${formatDecimal(minutes, 2)}′${hemisphere}`;
  }

  private getHemisphere(value: number, axis: 'x' | 'y'): string {
    if (value === 0) return axis === 'x' ? 'E' : 'N';
    if (axis === 'x') return value > 0 ? 'E' : 'W';
    return value > 0 ? 'N' : 'S';
  }
}
