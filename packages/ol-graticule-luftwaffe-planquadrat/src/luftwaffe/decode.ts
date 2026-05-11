/**
 * Reverse direction: a Luftwaffe map reference text to its geographic cell
 * (bounding box and centre). Lenient on whitespace, case, and slash
 * separators (e.g. "05 Ost / 61 / 2 / 3 / 2 / a"); strict on the structural
 * grammar of each system.
 *
 * GNMV honours the `era` argument; JMN is post-1943 only and ignores it
 * (its lower levels follow the refined 9-cell MelT/AT layout introduced on
 * 1 May 1943, which is also when the Jägermeldenetz itself was introduced).
 *
 * The grammar this parses mirrors the encoding rules documented at
 * prwg.co.uk's Halifax JB837 page (Ron Birch) and aircrewremembered.com's
 * Luftwaffe Grid Reference System article. See the package README for the
 * full credit.
 */

import { ParseError } from '@zwaarcontrast/ol-graticule';

import {
  ZZG_LAT_DEG,
  ZZG_LON_DEG,
  ZZG_NORTH_LIMIT,
  ZZG_BASELINE_LAT,
  GT_LAT_DEG,
  GT_LON_DEG,
  MT_LAT_DEG,
  MT_LON_DEG,
  KT_LAT_DEG,
  KT_LON_DEG,
  JAGDTRAPEZ_LAT_DEG,
  meldetrapezDims,
  arbeitstrapezDims,
} from './levels.js';
import { letterToIndex } from './letters.js';
import type {
  DecodedRef,
  GeoBox,
  LatLon,
  LuftwaffeEra,
  LuftwaffeSystem,
  ZzgSuffix,
} from './types.js';
import { suffixToken } from './encode.js';

const SUFFIX_TABLE: Array<{ token: string; suffix: ZzgSuffix; isEast: boolean; isSouth: boolean }> = [
  { token: 'SUEDOST',  suffix: 'Südost',  isEast: true,  isSouth: true  },
  { token: 'SUEDWEST', suffix: 'Südwest', isEast: false, isSouth: true  },
  { token: 'SUDOST',   suffix: 'Südost',  isEast: true,  isSouth: true  },
  { token: 'SUDWEST',  suffix: 'Südwest', isEast: false, isSouth: true  },
  { token: 'SOST',     suffix: 'Südost',  isEast: true,  isSouth: true  },
  { token: 'SWEST',    suffix: 'Südwest', isEast: false, isSouth: true  },
  { token: 'OST',      suffix: 'Ost',     isEast: true,  isSouth: false },
  { token: 'WEST',     suffix: 'West',    isEast: false, isSouth: false },
  { token: 'SO',       suffix: 'Südost',  isEast: true,  isSouth: true  },
  { token: 'SW',       suffix: 'Südwest', isEast: false, isSouth: true  },
  { token: 'O',        suffix: 'Ost',     isEast: true,  isSouth: false },
  { token: 'W',        suffix: 'West',    isEast: false, isSouth: false },
];

const PRE_AT_INDEX: Record<string, [number, number]> = {
  lo: [0, 0], ro: [0, 1], lu: [1, 0], ru: [1, 1],
};

class Cursor {
  rest: string;
  readonly original: string;

  constructor(text: string, original: string) {
    this.rest = text;
    this.original = original;
  }

  empty(): boolean {
    return this.rest.length === 0;
  }

  peek(): string | undefined {
    return this.rest[0];
  }

  take(n: number): string {
    const head = this.rest.slice(0, n);
    this.rest = this.rest.slice(n);
    return head;
  }

  fail(reason: string): never {
    throw new ParseError(this.original, reason);
  }
}

function normalizeInput(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/gi, 'ss')
    .replace(/[\s/,;]+/g, '')
    .toUpperCase();
}

function takeZzgDigits(c: Cursor): { lonTens: number; latTens: number } {
  const m = c.rest.match(/^(\d{2,3})/);
  if (!m) c.fail('expected 2 or 3 ZZG digits');
  const digits = m[1]!;
  c.take(digits.length);
  const latTens = Number(digits.slice(-1));
  const lonTens = Number(digits.slice(0, -1));
  if (latTens > 8) c.fail(`latitude ten-count out of range (got ${latTens}, max 8)`);
  if (lonTens > 18) c.fail(`longitude ten-count out of range (got ${lonTens}, max 18)`);
  return { lonTens, latTens };
}

function takeZzgHead(c: Cursor): {
  lonTens: number;
  latTens: number;
  suf: { suffix: ZzgSuffix; isEast: boolean; isSouth: boolean };
} {
  const { lonTens, latTens } = takeZzgDigits(c);
  const suf = takeSuffix(c);
  if (lonTens === 18 && suf.isEast) {
    c.fail('longitude ten-count 18 is only valid west of the antimeridian (W or SW)');
  }
  return { lonTens, latTens, suf };
}

function takeSuffix(c: Cursor): { suffix: ZzgSuffix; isEast: boolean; isSouth: boolean } {
  for (const entry of SUFFIX_TABLE) {
    if (c.rest.startsWith(entry.token)) {
      c.take(entry.token.length);
      return entry;
    }
  }
  return c.fail('expected ZZG suffix (O, W, SO, or SW)');
}

function zzgBoxFromTens(lonTens: number, latTens: number, isEast: boolean, isSouth: boolean): GeoBox {
  const nwLat = isSouth
    ? ZZG_BASELINE_LAT - ZZG_LAT_DEG * latTens
    : ZZG_BASELINE_LAT + ZZG_LAT_DEG + ZZG_LAT_DEG * latTens;
  const nwLon = isEast ? ZZG_LON_DEG * lonTens : -ZZG_LON_DEG * lonTens;
  return [nwLon, nwLat - ZZG_LAT_DEG, nwLon + ZZG_LON_DEG, nwLat];
}

function takeDigit(c: Cursor, label: string, max: number): number {
  const ch = c.peek();
  if (ch === undefined || !/[1-9]/.test(ch)) c.fail(`expected ${label} digit (1..${max})`);
  const n = Number(ch);
  if (n > max) c.fail(`${label} digit out of range (got ${n}, max ${max})`);
  c.take(1);
  return n;
}

function takeTwoDigits(c: Cursor, label: string): { lonOnes: number; latOnes: number } {
  if (c.rest.length < 2 || !/^\d{2}/.test(c.rest)) c.fail(`expected 2 ${label} digits`);
  const head = c.take(2);
  return { lonOnes: Number(head[0]!), latOnes: Number(head[1]!) };
}

function takeJmnHalf(c: Cursor): 'N' | 'S' {
  const ch = c.peek();
  if (ch === 'N' || ch === 'S') {
    c.take(1);
    return ch;
  }
  return c.fail('expected Jagdtrapez half (N or S)');
}

function takeJmnLetters(c: Cursor): { row: number; col: number; letters: string } {
  if (c.rest.length < 2) c.fail('expected JMN Mitteltrapez letter pair');
  const head = c.take(2);
  const row = letterToIndex(head[0]!);
  const col = letterToIndex(head[1]!);
  if (row < 0 || col < 0) c.fail(`invalid JMN Mitteltrapez letters "${head}"`);
  return { row, col, letters: head };
}

function takeAtLabel(c: Cursor, era: LuftwaffeEra): { row: number; col: number; label: string } {
  if (era === 'pre-1943') {
    const head = c.rest.slice(0, 2).toLowerCase();
    const idx = PRE_AT_INDEX[head];
    if (!idx) c.fail('expected pre-1943 Arbeitstrapez label (lo, ro, lu, or ru)');
    c.take(2);
    return { row: idx[0], col: idx[1], label: head };
  }
  const ch = c.peek();
  if (ch === undefined) c.fail('expected Arbeitstrapez label (a..i)');
  const lower = ch.toLowerCase();
  if (lower < 'a' || lower > 'i') c.fail(`expected Arbeitstrapez label (a..i), got "${ch}"`);
  const offset = lower.charCodeAt(0) - 'a'.charCodeAt(0);
  c.take(1);
  return { row: Math.floor(offset / 3), col: offset % 3, label: lower };
}

function endIfTrailing(c: Cursor): void {
  if (!c.empty()) c.fail(`unexpected trailing characters "${c.rest}"`);
}

function childBox(parentBbox: GeoBox, latSpan: number, lonSpan: number, row: number, col: number): GeoBox {
  const parentNwLat = parentBbox[3];
  const parentNwLon = parentBbox[0];
  const nwLat = parentNwLat - latSpan * row;
  const nwLon = parentNwLon + lonSpan * col;
  return [nwLon, nwLat - latSpan, nwLon + lonSpan, nwLat];
}

/** Find the GT NW latitude inside a ZZG whose ones-digit equals `latOnes`. */
function findGtNwLat(zzgBbox: GeoBox, latOnes: number): number {
  const swLat = zzgBbox[1];
  const nwLat = zzgBbox[3];
  for (let lat = nwLat; lat > swLat; lat -= GT_LAT_DEG) {
    if (Math.abs(Math.round(lat)) % 10 === latOnes) return lat;
  }
  throw new ParseError(String(latOnes), `Großtrapez latitude digit ${latOnes} is outside this ZZG`);
}

/** Find the GT NW longitude inside a ZZG whose ones-digit equals `lonOnes`. */
function findGtNwLon(zzgBbox: GeoBox, lonOnes: number): number {
  const nwLon = zzgBbox[0];
  const seLon = zzgBbox[2];
  for (let lon = nwLon; lon < seLon; lon += GT_LON_DEG) {
    if (((Math.abs(Math.round(lon)) % 10) + 10) % 10 === lonOnes) return lon;
  }
  throw new ParseError(String(lonOnes), `Großtrapez longitude digit ${lonOnes} is outside this ZZG`);
}

function bboxCentre(bbox: GeoBox): LatLon {
  return [(bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2];
}

function decodeKtMeltAt(c: Cursor, bbox: GeoBox, era: LuftwaffeEra): { bbox: GeoBox; depth: number; pieces: string[] } {
  const pieces: string[] = [];
  let depth = 2;
  if (c.empty()) return { bbox, depth, pieces };

  const ktDigit = takeDigit(c, 'Kleintrapez', 9);
  depth = 3;
  pieces.push(String(ktDigit));
  bbox = childBox(bbox, KT_LAT_DEG, KT_LON_DEG, Math.floor((ktDigit - 1) / 3), (ktDigit - 1) % 3);
  if (c.empty()) return { bbox, depth, pieces };

  const dims = meldetrapezDims(era);
  const meltDigit = takeDigit(c, 'Meldetrapez', dims.rows * dims.cols);
  depth = 4;
  pieces.push(String(meltDigit));
  bbox = childBox(bbox, dims.latDeg, dims.lonDeg, Math.floor((meltDigit - 1) / dims.cols), (meltDigit - 1) % dims.cols);
  if (c.empty()) return { bbox, depth, pieces };

  const at = takeAtLabel(c, era);
  depth = 5;
  pieces.push(at.label);
  const atDims = arbeitstrapezDims(era);
  bbox = childBox(bbox, atDims.latDeg, atDims.lonDeg, at.row, at.col);

  endIfTrailing(c);
  return { bbox, depth, pieces };
}

function makeDecoded(canonical: string, formatted: string, bbox: GeoBox, depth: number): DecodedRef {
  if (bbox[3] > ZZG_NORTH_LIMIT + 1e-9) {
    throw new ParseError(canonical, 'reference is above 89°N');
  }
  return { canonical, formatted, bbox, center: bboxCentre(bbox), depth };
}

/** Parse a Gradnetzmeldeverfahren (GNMV) reference. Pre-1943 era understands `lo/ro/lu/ru` labels. */
export function parseGnmvRef(text: string, era: LuftwaffeEra = 'post-1943'): DecodedRef {
  if (typeof text !== 'string') throw new ParseError(String(text), 'expected string input');
  const normalized = normalizeInput(text);
  if (normalized.length === 0) throw new ParseError(text, 'empty input');

  const c = new Cursor(normalized, text);
  const { lonTens, latTens, suf } = takeZzgHead(c);
  let bbox = zzgBoxFromTens(lonTens, latTens, suf.isEast, suf.isSouth);
  let depth = 0;

  let canonical = `${lonTens}${latTens}${suffixToken(suf.suffix)}`;
  let formatted = `${lonTens}${latTens} ${suf.suffix}`;
  if (c.empty()) return makeDecoded(canonical, formatted, bbox, depth);

  const gt = takeTwoDigits(c, 'Großtrapez');
  depth = 1;
  canonical += `${gt.lonOnes}${gt.latOnes}`;
  formatted += ` ${gt.lonOnes}${gt.latOnes}`;
  const gtNwLat = findGtNwLat(bbox, gt.latOnes);
  const gtNwLon = findGtNwLon(bbox, gt.lonOnes);
  bbox = [gtNwLon, gtNwLat - GT_LAT_DEG, gtNwLon + GT_LON_DEG, gtNwLat];

  if (c.empty()) return makeDecoded(canonical, formatted, bbox, depth);

  const mtDigit = takeDigit(c, 'Mitteltrapez', 8);
  depth = 2;
  canonical += String(mtDigit);
  formatted += ` ${mtDigit}`;
  bbox = childBox(bbox, MT_LAT_DEG, MT_LON_DEG, Math.floor((mtDigit - 1) / 2), (mtDigit - 1) % 2);

  const tail = decodeKtMeltAt(c, bbox, era);
  bbox = tail.bbox;
  depth = tail.depth;
  for (const piece of tail.pieces) {
    canonical += piece;
    formatted += ` ${piece}`;
  }
  return makeDecoded(canonical, formatted, bbox, depth);
}

/** Parse a Jägermeldenetz (JMN) reference. JMN is post-1943 only. */
export function parseJmnRef(text: string): DecodedRef {
  if (typeof text !== 'string') throw new ParseError(String(text), 'expected string input');
  const normalized = normalizeInput(text);
  if (normalized.length === 0) throw new ParseError(text, 'empty input');

  const c = new Cursor(normalized, text);
  const { lonTens, latTens, suf } = takeZzgHead(c);
  let bbox = zzgBoxFromTens(lonTens, latTens, suf.isEast, suf.isSouth);
  let depth = 0;

  let canonical = `${lonTens}${latTens}${suffixToken(suf.suffix)}`;
  let formatted = `${lonTens}${latTens} ${suf.suffix}`;
  if (c.empty()) return makeDecoded(canonical, formatted, bbox, depth);

  const half = takeJmnHalf(c);
  depth = 1;
  canonical += half;
  formatted += ` ${half}`;
  const zzgNwLat = bbox[3];
  const halfNwLat = half === 'N' ? zzgNwLat : zzgNwLat - JAGDTRAPEZ_LAT_DEG;
  bbox = [bbox[0], halfNwLat - JAGDTRAPEZ_LAT_DEG, bbox[2], halfNwLat];

  if (c.empty()) return makeDecoded(canonical, formatted, bbox, depth);

  const letters = takeJmnLetters(c);
  depth = 2;
  canonical += letters.letters;
  formatted += ` ${letters.letters}`;
  bbox = childBox(bbox, MT_LAT_DEG, MT_LON_DEG, letters.row, letters.col);

  const tail = decodeKtMeltAt(c, bbox, 'post-1943');
  bbox = tail.bbox;
  depth = tail.depth;
  for (const piece of tail.pieces) {
    canonical += piece;
    formatted += ` ${piece}`;
  }
  return makeDecoded(canonical, formatted, bbox, depth);
}

export interface ParseResult {
  decoded: DecodedRef;
  system: LuftwaffeSystem;
}

/** Parse either system, preferring a non-throwing JMN match. JMN is post-1943 only. */
export function parseRef(text: string, era: LuftwaffeEra = 'post-1943'): ParseResult {
  let jmnError: ParseError | undefined;
  try {
    return { decoded: parseJmnRef(text), system: 'jmn' };
  } catch (err) {
    if (err instanceof ParseError) jmnError = err;
    else throw err;
  }
  try {
    return { decoded: parseGnmvRef(text, era), system: 'gnmv' };
  } catch (err) {
    if (!(err instanceof ParseError)) throw err;
    throw new ParseError(text, `not JMN (${jmnError.reason}), not GNMV (${err.reason})`);
  }
}
