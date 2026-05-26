/**
 * Shared text-format primitives for both HMN variants (planar and geographic).
 * The canonical string layout (`"XX nA dd"`), the lenient parsing regex, and
 * the 0..9 tenth clamp are identical across variants; only the underlying
 * coordinate space differs.
 */

import { letterToIndex } from './letters.js';
import type { Arbeitstrapez } from './types.js';

/**
 * Canonical HMN reference pattern, case-insensitive and whitespace-tolerant:
 *   `"XX"`, `"XX n"`, `"XX nA"`, `"XX nA dd"`
 * Captures: kleinCol, kleinRow, meldetrapez, arbeitstrapez, tenths.
 */
export const HMN_LABEL_PATTERN =
  /^\s*([A-HJ-Z])([A-HJ-Z])\s*(?:([1-9])(?:\s*([a-d])(?:\s*(\d{2}))?)?)?\s*$/i;

/**
 * Format an HMN label from its decomposed pieces. Output:
 *   - depth 2: `"PE"`
 *   - depth 3: `"PE 5"`
 *   - depth 4: `"PE 5b"`
 *   - depth 5: `"PE 5b 24"`
 */
export function canonicalizeHmnLabel(
  klein: string,
  melde: number | undefined,
  arbeit: Arbeitstrapez | undefined,
  tenths: [number, number] | undefined,
): string {
  let out = klein;
  if (melde === undefined) return out;
  out += ' ' + melde;
  if (arbeit === undefined) return out;
  out += arbeit;
  if (tenths === undefined) return out;
  out += ' ' + tenths[0] + tenths[1];
  return out;
}

/** Clamp a tenth offset to the 0..9 range. */
export function clampTenth(n: number): number {
  return Math.max(0, Math.min(9, n));
}

/**
 * Pieces extracted from an HMN canonical string. All variant-agnostic: the
 * column / row letters resolve to numeric indices, the optional subdivision
 * tokens are typed, and the depth (2..5) reflects how many subdivisions
 * were present.
 */
interface HmnTokens {
  /** Column letter index 0..24 (A..Z, no I). */
  kx: number;
  /** Row letter index 0..24. */
  ky: number;
  /** Original column letter, uppercased. */
  col: string;
  /** Original row letter, uppercased. */
  row: string;
  meldetrapez: number | undefined;
  arbeitstrapez: Arbeitstrapez | undefined;
  tenths: [number, number] | undefined;
  depth: 2 | 3 | 4 | 5;
}

function toArbeitstrapez(text: string): Arbeitstrapez | undefined {
  const lower = text.toLowerCase();
  if (lower === 'a' || lower === 'b' || lower === 'c' || lower === 'd') return lower;
  return undefined;
}

/**
 * Match an HMN canonical string and extract its parts. Returns `undefined`
 * if the text doesn't match the grammar or contains a forbidden letter
 * (`I` in the pair, sub-letter outside `a..d`, etc.).
 */
export function parseHmnTokens(text: string): HmnTokens | undefined {
  const matched = text.match(HMN_LABEL_PATTERN);
  if (!matched) return undefined;
  const colRaw = matched[1];
  const rowRaw = matched[2];
  const meldeStr = matched[3];
  const arbeitStr = matched[4];
  const tenthsStr = matched[5];
  if (!colRaw || !rowRaw) return undefined;

  const col = colRaw.toUpperCase();
  const row = rowRaw.toUpperCase();
  const kx = letterToIndex(col);
  const ky = letterToIndex(row);
  if (kx < 0 || ky < 0) return undefined;

  const meldetrapez = meldeStr ? Number(meldeStr) : undefined;
  const arbeitstrapez = arbeitStr ? toArbeitstrapez(arbeitStr) : undefined;
  if (arbeitStr && !arbeitstrapez) return undefined;
  const tenths: [number, number] | undefined = tenthsStr
    ? [Number(tenthsStr[0]), Number(tenthsStr[1])]
    : undefined;

  let depth: 2 | 3 | 4 | 5;
  if (tenths) depth = 5;
  else if (arbeitstrapez) depth = 4;
  else if (meldetrapez !== undefined) depth = 3;
  else depth = 2;

  return { col, row, kx, ky, meldetrapez, arbeitstrapez, tenths, depth };
}
