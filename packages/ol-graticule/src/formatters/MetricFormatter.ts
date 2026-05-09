import type { LabelFormatter } from '../types.js';
import { BoundedCache } from '../util/boundedCache.js';
import { formatDecimal } from '../util/formatNumber.js';
import { ParseError } from '../util/ParseError.js';
import { splitCoordinatePair } from '../util/parseCoordinatePair.js';

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

  parse(text: string, _axis?: 'x' | 'y'): number {
    return parseLinear(text, this.unit_);
  }

  parseCoordinate(text: string): [number, number] {
    if (text.trim().length === 0) throw new ParseError(text, 'empty input');
    const trimmed = text.trim();

    let halves: [string, string];
    if (trimmed.includes(',')) {
      halves = splitCoordinatePair(trimmed);
    } else {
      halves = splitWhitespacePair_(trimmed);
    }

    const secondTrailingUnit = halves[1].match(UNIT_SUFFIX_RE);
    if (secondTrailingUnit && !UNIT_SUFFIX_RE.test(halves[0])) {
      const tag = secondTrailingUnit[1]!.replace(/\s+/g, '-');
      halves = [`${halves[0]} ${tag}`, halves[1]];
    }

    return [parseLinear(halves[0], this.unit_), parseLinear(halves[1], this.unit_)];
  }
}

const UNIT_SUFFIX_RE = /(us[-\s]?ft|km|ft|m)\s*$/i;
const BARE_UNIT_RE = /^(us[-\s]?ft|km|ft|m)$/i;

function splitWhitespacePair_(trimmed: string): [string, string] {
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 2) return [tokens[0]!, tokens[1]!];
  if (tokens.length === 3 && BARE_UNIT_RE.test(tokens[2]!)) {
    return [tokens[0]!, `${tokens[1]} ${tokens[2]}`];
  }
  if (tokens.length === 4 && BARE_UNIT_RE.test(tokens[1]!) && BARE_UNIT_RE.test(tokens[3]!)) {
    return [`${tokens[0]} ${tokens[1]}`, `${tokens[2]} ${tokens[3]}`];
  }
  throw new ParseError(trimmed, 'expected "x y" pair (with optional unit suffix)');
}

/** Parses a metric/foot value with optional unit suffix. Returns the value in `nativeUnit`. */
export function parseLinear(text: string, nativeUnit: 'm' | 'ft' | 'us-ft'): number {
  if (text.trim().length === 0) throw new ParseError(text, 'empty input');
  const trimmed = text.trim();

  const unitMatch = trimmed.match(UNIT_SUFFIX_RE);
  let unit: 'm' | 'km' | 'ft' | 'us-ft' | undefined;
  let numericPart = trimmed;
  if (unitMatch) {
    const tag = unitMatch[1]!.toLowerCase().replace(/\s/g, '-');
    if (tag === 'us-ft' || tag === 'usft') unit = 'us-ft';
    else if (tag === 'km' || tag === 'ft' || tag === 'm') unit = tag;
    else throw new ParseError(text, `unknown unit "${tag}"`);
    numericPart = trimmed.slice(0, unitMatch.index).trim();
  }

  const cleaned = numericPart.replace(/,/g, '').replace(/\s+/g, '');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(cleaned)) {
    throw new ParseError(text, 'invalid numeric value');
  }
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) throw new ParseError(text, 'invalid number');

  if (unit === undefined) return value;

  if (unit === 'km') {
    if (nativeUnit !== 'm') {
      throw new ParseError(text, `unit "km" not compatible with formatter unit "${nativeUnit}"`);
    }
    return value * 1000;
  }
  if (unit !== nativeUnit) {
    throw new ParseError(text, `unit "${unit}" not compatible with formatter unit "${nativeUnit}"`);
  }
  return value;
}
