import type { LabelFormatter } from '../types.js';
import { BoundedCache } from '../util/boundedCache.js';
import { ParseError } from '../util/ParseError.js';
import { splitCoordinatePair } from '../util/parseCoordinatePair.js';

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

  parse(text: string, _axis?: 'x' | 'y'): number {
    if (text.trim().length === 0) throw new ParseError(text, 'empty input');
    const cleaned = text.trim().replace(/px$/i, '').trim();
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(cleaned)) {
      throw new ParseError(text, 'invalid pixel value');
    }
    const value = Number.parseFloat(cleaned);
    if (!Number.isFinite(value)) throw new ParseError(text, 'invalid number');
    return value;
  }

  parseCoordinate(text: string): [number, number] {
    if (text.trim().length === 0) throw new ParseError(text, 'empty input');
    const trimmed = text.trim();

    let halves: [string, string];
    if (trimmed.includes(',')) {
      halves = splitCoordinatePair(trimmed);
    } else {
      halves = splitWhitespacePixelPair_(trimmed);
    }
    return [this.parse(halves[0]), this.parse(halves[1])];
  }
}

const BARE_PX_RE = /^px$/i;

function splitWhitespacePixelPair_(trimmed: string): [string, string] {
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 2) return [tokens[0]!, tokens[1]!];
  if (tokens.length === 3 && BARE_PX_RE.test(tokens[2]!)) {
    return [tokens[0]!, `${tokens[1]} ${tokens[2]}`];
  }
  if (tokens.length === 4 && BARE_PX_RE.test(tokens[1]!) && BARE_PX_RE.test(tokens[3]!)) {
    return [`${tokens[0]} ${tokens[1]}`, `${tokens[2]} ${tokens[3]}`];
  }
  throw new ParseError(trimmed, 'expected "x y" pair (with optional px suffix)');
}
