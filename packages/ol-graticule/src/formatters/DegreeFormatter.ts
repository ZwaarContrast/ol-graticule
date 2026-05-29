import type { LabelFormatter } from '../types.js';
import { BoundedCache } from '../util/boundedCache.js';
import { formatDecimal } from '../util/formatNumber.js';
import { ParseError } from '../util/ParseError.js';
import { splitCoordinatePair } from '../util/parseCoordinatePair.js';

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
    let degrees = Math.floor(abs);
    let minutes = (abs - degrees) * 60;

    // Use toFixed(2) for speed; formatDecimal's trailing-zero stripping is
    // expensive and less idiomatic for DDM than fixed precision.
    let minutesStr = minutes.toFixed(2);
    if (minutesStr === '60.00') {
      minutesStr = '00.00';
      degrees += 1;
    }

    return `${degrees}°${minutesStr}′${hemisphere}`;
  }

  private getHemisphere(value: number, axis: 'x' | 'y'): string {
    if (value === 0) return axis === 'x' ? 'E' : 'N';
    if (axis === 'x') return value > 0 ? 'E' : 'W';
    return value > 0 ? 'N' : 'S';
  }

  parse(text: string, axis: 'x' | 'y'): number {
    if (text.trim().length === 0) throw new ParseError(text, 'empty input');

    const preStripped = text.replace(
      /(\d)\s*[dDmMs](?=\d|\s|$|[NSEWnsew]|°|'|′|"|″)/g,
      '$1 ',
    );

    const hemMatches = preStripped.match(/[NSEWnsew]/g);
    if (hemMatches && hemMatches.length > 1) {
      throw new ParseError(text, 'multiple hemisphere indicators');
    }
    const hemSign = hemMatches ? hemisphereSign(hemMatches[0]!, axis, text) : 0;

    const cleaned = preStripped.replace(/[°'′"″NSEWnsew]/g, ' ');
    const tokens = cleaned.match(/[+-]?\d+(?:\.\d+)?/g);
    if (!tokens || tokens.length === 0) {
      throw new ParseError(text, 'no numeric value found');
    }
    if (tokens.length > 3) {
      throw new ParseError(text, 'too many numeric components');
    }

    const nums = tokens.map((t) => Number.parseFloat(t));
    for (const n of nums) {
      if (!Number.isFinite(n)) throw new ParseError(text, 'invalid number');
    }

    const firstNeg = nums[0]! < 0;
    const d = Math.abs(nums[0]!);
    const m = nums[1] !== undefined ? Math.abs(nums[1]) : 0;
    const s = nums[2] !== undefined ? Math.abs(nums[2]) : 0;
    if (m >= 60) throw new ParseError(text, 'minutes >= 60');
    if (s >= 60) throw new ParseError(text, 'seconds >= 60');

    const magnitude = d + m / 60 + s / 3600;
    const sign = hemSign !== 0 ? hemSign : firstNeg ? -1 : 1;
    return sign * magnitude;
  }

  parseCoordinate(text: string): [number, number] {
    const [first, second] = splitCoordinatePair(text);
    const firstHem = first.match(/[NSEWnsew]/)?.[0]?.toUpperCase();
    const secondHem = second.match(/[NSEWnsew]/)?.[0]?.toUpperCase();
    const firstIsLat = firstHem === 'N' || firstHem === 'S';
    const secondIsLon = secondHem === 'E' || secondHem === 'W';
    const swap = firstIsLat || secondIsLon;
    const lonText = swap ? second : first;
    const latText = swap ? first : second;
    return [this.parse(lonText, 'x'), this.parse(latText, 'y')];
  }
}

function hemisphereSign(letter: string, axis: 'x' | 'y', text: string): 1 | -1 {
  const upper = letter.toUpperCase();
  if ((upper === 'N' || upper === 'S') && axis !== 'y') {
    throw new ParseError(text, `hemisphere "${upper}" not valid for x-axis`);
  }
  if ((upper === 'E' || upper === 'W') && axis !== 'x') {
    throw new ParseError(text, `hemisphere "${upper}" not valid for y-axis`);
  }
  return upper === 'N' || upper === 'E' ? 1 : -1;
}
