import type { LabelFormatter } from '../types.js';
import { ParseError } from './ParseError.js';

/**
 * Split a coordinate-pair string into its two halves.
 *
 * Accepts `"x, y"`, `"x,y"`, or `"x y"`. The two halves are returned in input
 * order; callers route them to axes themselves (e.g. via hemisphere markers
 * for geographic input). Throws {@link ParseError} when the input does not
 * cleanly split into exactly two non-empty parts.
 */
export function splitCoordinatePair(text: string): [string, string] {
  if (text.trim().length === 0) throw new ParseError(text, 'empty input');
  const trimmed = text.trim();

  if (trimmed.includes(',')) {
    const parts = trimmed.split(',');
    if (parts.length !== 2) {
      throw new ParseError(text, 'expected exactly two comma-separated parts');
    }
    const left = parts[0]!.trim();
    const right = parts[1]!.trim();
    if (left.length === 0 || right.length === 0) {
      throw new ParseError(text, 'comma split produced empty side');
    }
    return [left, right];
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 2) return [tokens[0]!, tokens[1]!];

  throw new ParseError(text, 'expected "x y" or "x, y" pair');
}

/**
 * Parse a coordinate pair through `formatter`. Prefers `formatter.parseCoordinate`
 * (which knows about compound forms, pair-level units, hemisphere routing);
 * falls back to splitting and calling `formatter.parse` per axis. Throws
 * {@link ParseError} when the formatter has neither method.
 */
export function parsePairViaFormatter(
  formatter: LabelFormatter,
  text: string,
): [number, number] {
  if (formatter.parseCoordinate) return formatter.parseCoordinate(text);
  if (!formatter.parse) {
    throw new ParseError(text, 'formatter does not support parsing');
  }
  const [first, second] = splitCoordinatePair(text);
  return [formatter.parse(first, 'x'), formatter.parse(second, 'y')];
}
